package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.dto.AiPricingRecommendationDto;
import com.clenzy.dto.PricePredictionDto;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.AiKeyResolver.ResolvedKey;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class AiPricingService {

    private static final Logger log = LoggerFactory.getLogger(AiPricingService.class);
    private static final BigDecimal WEEKEND_MULTIPLIER = new BigDecimal("1.15");
    private static final BigDecimal HIGH_DEMAND_MULTIPLIER = new BigDecimal("1.25");
    private static final BigDecimal LOW_DEMAND_MULTIPLIER = new BigDecimal("0.85");
    private static final BigDecimal LAST_MINUTE_DISCOUNT = new BigDecimal("0.80");

    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final RateOverrideRepository rateOverrideRepository;
    private final AiProperties aiProperties;
    private final AiAnonymizationService anonymizationService;
    private final AiTokenBudgetService tokenBudgetService;
    private final AiProviderRouter aiProviderRouter;
    private final ObjectMapper objectMapper;

    public AiPricingService(ReservationRepository reservationRepository,
                             PropertyRepository propertyRepository,
                             RateOverrideRepository rateOverrideRepository,
                             AiProperties aiProperties,
                             AiAnonymizationService anonymizationService,
                             AiTokenBudgetService tokenBudgetService,
                             AiProviderRouter aiProviderRouter,
                             ObjectMapper objectMapper) {
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.rateOverrideRepository = rateOverrideRepository;
        this.aiProperties = aiProperties;
        this.anonymizationService = anonymizationService;
        this.tokenBudgetService = tokenBudgetService;
        this.aiProviderRouter = aiProviderRouter;
        this.objectMapper = objectMapper;
    }

    /**
     * Genere des predictions de prix pour une propriete sur une periode.
     */
    public List<PricePredictionDto> getPredictions(Long propertyId, Long orgId,
                                                    LocalDate from, LocalDate to) {
        Property property = propertyRepository.findById(propertyId)
            .orElseThrow(() -> new IllegalArgumentException("Property not found: " + propertyId));

        BigDecimal basePrice = property.getNightlyPrice() != null ? property.getNightlyPrice() : new BigDecimal("100");

        List<Reservation> historicalReservations = reservationRepository.findByPropertyIdsAndDateRange(
            List.of(propertyId), from.minusYears(1), to, orgId);

        List<PricePredictionDto> predictions = new ArrayList<>();
        LocalDate current = from;

        while (!current.isAfter(to)) {
            PricePredictionDto prediction = predictForDate(
                propertyId, current, basePrice, historicalReservations, orgId);
            predictions.add(prediction);
            current = current.plusDays(1);
        }

        return predictions;
    }

    PricePredictionDto predictForDate(Long propertyId, LocalDate date,
                                             BigDecimal basePrice,
                                             List<Reservation> historicalReservations,
                                             Long orgId) {
        double demandScore = calculateDemandScore(date, historicalReservations);
        double predictedOccupancy = calculatePredictedOccupancy(date, historicalReservations);
        boolean isWeekend = date.getDayOfWeek() == DayOfWeek.FRIDAY
                         || date.getDayOfWeek() == DayOfWeek.SATURDAY;
        long daysUntil = ChronoUnit.DAYS.between(LocalDate.now(), date);

        BigDecimal suggestedPrice = basePrice;
        String reason;

        // Weekend premium
        if (isWeekend) {
            suggestedPrice = suggestedPrice.multiply(WEEKEND_MULTIPLIER);
        }

        // Demand-based adjustment
        if (demandScore > 0.7) {
            suggestedPrice = suggestedPrice.multiply(HIGH_DEMAND_MULTIPLIER);
            reason = "High demand detected (" + Math.round(demandScore * 100) + "%)";
        } else if (demandScore < 0.3 && daysUntil <= 7) {
            suggestedPrice = suggestedPrice.multiply(LAST_MINUTE_DISCOUNT);
            reason = "Last-minute low demand - discount applied";
        } else if (demandScore < 0.3) {
            suggestedPrice = suggestedPrice.multiply(LOW_DEMAND_MULTIPLIER);
            reason = "Low demand period";
        } else {
            reason = "Normal demand";
        }

        if (isWeekend) {
            reason += " + weekend premium";
        }

        suggestedPrice = suggestedPrice.setScale(2, RoundingMode.HALF_UP);
        BigDecimal minPrice = basePrice.multiply(new BigDecimal("0.70")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal maxPrice = basePrice.multiply(new BigDecimal("1.50")).setScale(2, RoundingMode.HALF_UP);
        double confidence = calculateConfidence(historicalReservations.size(), daysUntil);

        return new PricePredictionDto(
            propertyId, date, basePrice, suggestedPrice,
            minPrice, maxPrice, confidence, predictedOccupancy, demandScore, reason
        );
    }

    double calculateDemandScore(LocalDate date, List<Reservation> historicalReservations) {
        // Score base sur le nombre de reservations historiques pour cette periode
        long samePeriodBookings = historicalReservations.stream()
            .filter(r -> r.getCheckIn() != null && r.getCheckOut() != null)
            .filter(r -> {
                int dayOfYear = date.getDayOfYear();
                int reservationDay = r.getCheckIn().getDayOfYear();
                return Math.abs(dayOfYear - reservationDay) <= 14;
            })
            .count();

        return Math.min(1.0, samePeriodBookings / 5.0);
    }

    double calculatePredictedOccupancy(LocalDate date, List<Reservation> historicalReservations) {
        long bookedSamePeriod = historicalReservations.stream()
            .filter(r -> r.getCheckIn() != null && r.getCheckOut() != null)
            .filter(r -> !date.isBefore(r.getCheckIn()) && date.isBefore(r.getCheckOut()))
            .count();
        return bookedSamePeriod > 0 ? 1.0 : 0.0;
    }

    double calculateConfidence(int historicalDataPoints, long daysUntil) {
        double dataConfidence = Math.min(1.0, historicalDataPoints / 20.0);
        double timeConfidence = daysUntil <= 7 ? 0.9 : daysUntil <= 30 ? 0.7 : 0.5;
        return Math.round((dataConfidence * 0.6 + timeConfidence * 0.4) * 100.0) / 100.0;
    }

    // ─── AI-powered predictions (LLM) ───────────────────────────────────

    /**
     * Predictions de prix via LLM (Anthropic Claude).
     * Necessite que le feature flag pricingAi soit active.
     * Fallback sur le rule-based en cas d'erreur.
     */
    @CircuitBreaker(name = "ai-pricing")
    @Retry(name = "ai-pricing")
    public List<AiPricingRecommendationDto> getAiPredictions(Long propertyId, Long orgId,
                                                              LocalDate from, LocalDate to) {
        if (!aiProperties.getFeatures().isPricingAi()) {
            throw new AiNotConfiguredException("AI_FEATURE_DISABLED", "pricing",
                    "AI pricing is disabled. Enable via clenzy.ai.features.pricing-ai=true");
        }

        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.PRICING);
        ResolvedKey key = aiProviderRouter.resolveKey(orgId, "anthropic", AiFeature.PRICING);
        tokenBudgetService.requireBudget(orgId, AiFeature.PRICING, key.source());

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Property not found: " + propertyId));

        BigDecimal basePrice = property.getNightlyPrice() != null ? property.getNightlyPrice() : new BigDecimal("100");

        List<Reservation> historical = reservationRepository.findByPropertyIdsAndDateRange(
                List.of(propertyId), from.minusYears(1), to, orgId);

        double avgOccupancy = historical.isEmpty() ? 0.0 :
                historical.stream()
                        .filter(r -> r.getCheckIn() != null && r.getCheckOut() != null)
                        .count() / 365.0;

        String userPrompt = AiPricingPrompts.buildUserPrompt(
                propertyId, basePrice, from, to, historical.size(), avgOccupancy, null);

        String anonymizedPrompt = anonymizationService.anonymize(userPrompt);

        AiRequest request = new AiRequest(
                AiPricingPrompts.SYSTEM_PROMPT,
                anonymizedPrompt,
                null, 0.3, 4096, false
        );

        RoutedResponse routed = aiProviderRouter.route(orgId, "anthropic", AiFeature.PRICING, request);

        tokenBudgetService.recordUsage(orgId, AiFeature.PRICING, routed.providerName(), routed.response());

        try {
            return objectMapper.readValue(routed.response().content(), new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            log.error("Failed to parse AI pricing response: {}", e.getMessage());
            throw new AiProviderException(routed.providerName(), "Failed to parse pricing response", e);
        }
    }
}
