package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiProviderException;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.config.ai.AnthropicProvider;
import com.clenzy.dto.AiPricingRecommendationDto;
import com.clenzy.dto.PricePredictionDto;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.AiKeyResolver.KeySource;
import com.clenzy.service.AiKeyResolver.ResolvedKey;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiPricingServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private AiProperties aiProperties;
    @Mock private AnthropicProvider anthropicProvider;
    @Mock private AiAnonymizationService anonymizationService;
    @Mock private AiTokenBudgetService tokenBudgetService;
    @Mock private AiKeyResolver aiKeyResolver;
    @Spy  private ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    @InjectMocks private AiPricingService service;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 100L;

    private Property createProperty(BigDecimal nightlyPrice) {
        Property p = new Property();
        p.setId(PROPERTY_ID);
        p.setNightlyPrice(nightlyPrice);
        return p;
    }

    private Reservation createReservation(LocalDate checkIn, LocalDate checkOut) {
        Reservation r = new Reservation();
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        return r;
    }

    // ─── Rule-based predictions (existing tests) ─────────────────────────

    @Test
    void getPredictions_returnsCorrectNumberOfDays() {
        when(propertyRepository.findById(PROPERTY_ID))
            .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));
        when(reservationRepository.findByPropertyIdsAndDateRange(any(), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of());

        LocalDate from = LocalDate.of(2025, 6, 1);
        LocalDate to = LocalDate.of(2025, 6, 7);

        List<PricePredictionDto> predictions = service.getPredictions(PROPERTY_ID, ORG_ID, from, to);

        assertEquals(7, predictions.size());
    }

    @Test
    void predictForDate_weekendPremium() {
        BigDecimal basePrice = new BigDecimal("100");
        // Saturday far in the future to avoid last-minute logic
        LocalDate saturday = LocalDate.now().plusDays(60);
        while (saturday.getDayOfWeek() != java.time.DayOfWeek.SATURDAY) {
            saturday = saturday.plusDays(1);
        }

        // Provide enough reservations to avoid low-demand discount
        List<Reservation> reservations = List.of(
            createReservation(saturday.minusDays(5), saturday.plusDays(2)),
            createReservation(saturday.minusDays(10), saturday.minusDays(3)),
            createReservation(saturday.minusDays(7), saturday.plusDays(1))
        );

        PricePredictionDto result = service.predictForDate(
            PROPERTY_ID, saturday, basePrice, reservations, ORG_ID);

        assertTrue(result.suggestedPrice().compareTo(basePrice) > 0);
        assertTrue(result.reason().contains("weekend"));
    }

    @Test
    void predictForDate_normalDemand() {
        BigDecimal basePrice = new BigDecimal("100");
        // Wednesday far in the future to avoid last-minute
        LocalDate wednesday = LocalDate.now().plusDays(60);
        while (wednesday.getDayOfWeek() != java.time.DayOfWeek.WEDNESDAY) {
            wednesday = wednesday.plusDays(1);
        }

        // Provide moderate reservations (not too many, not too few)
        List<Reservation> reservations = List.of(
            createReservation(wednesday.minusDays(5), wednesday.plusDays(2)),
            createReservation(wednesday.minusDays(10), wednesday.minusDays(3))
        );

        PricePredictionDto result = service.predictForDate(
            PROPERTY_ID, wednesday, basePrice, reservations, ORG_ID);

        assertEquals("Normal demand", result.reason());
    }

    @Test
    void calculateDemandScore_noData() {
        double score = service.calculateDemandScore(LocalDate.now(), List.of());
        assertEquals(0.0, score);
    }

    @Test
    void calculateDemandScore_withData() {
        LocalDate target = LocalDate.of(2025, 6, 15);
        List<Reservation> reservations = List.of(
            createReservation(LocalDate.of(2025, 6, 10), LocalDate.of(2025, 6, 20)),
            createReservation(LocalDate.of(2025, 6, 12), LocalDate.of(2025, 6, 18)),
            createReservation(LocalDate.of(2025, 6, 14), LocalDate.of(2025, 6, 16))
        );

        double score = service.calculateDemandScore(target, reservations);
        assertTrue(score > 0);
        assertTrue(score <= 1.0);
    }

    @Test
    void calculateConfidence_moreDataHigherConfidence() {
        double lowData = service.calculateConfidence(2, 14);
        double highData = service.calculateConfidence(30, 14);
        assertTrue(highData > lowData);
    }

    @Test
    void getPredictions_propertyNotFound_throws() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
            () -> service.getPredictions(PROPERTY_ID, ORG_ID, LocalDate.now(), LocalDate.now().plusDays(7)));
    }

    // ─── AI-powered predictions (LLM) ───────────────────────────────────

    @Nested
    @DisplayName("AI-powered predictions")
    class AiPowered {

        private static final ResolvedKey PLATFORM_KEY = new ResolvedKey("sk-platform", null, KeySource.PLATFORM);

        @Test
        void featureFlagDisabled_throwsException() {
            AiProperties.Features features = new AiProperties.Features();
            features.setPricingAi(false);
            when(aiProperties.getFeatures()).thenReturn(features);

            assertThrows(AiNotConfiguredException.class,
                    () -> service.getAiPredictions(PROPERTY_ID, ORG_ID,
                            LocalDate.now(), LocalDate.now().plusDays(3)));
        }

        @Test
        void validResponse_parsesCorrectly() {
            // Setup feature flag
            AiProperties.Features features = new AiProperties.Features();
            features.setPricingAi(true);
            when(aiProperties.getFeatures()).thenReturn(features);

            // Key resolver → platform key
            when(aiKeyResolver.resolve(ORG_ID, "anthropic")).thenReturn(PLATFORM_KEY);

            // Budget OK
            doNothing().when(tokenBudgetService).requireBudget(ORG_ID, AiFeature.PRICING, KeySource.PLATFORM);

            // Property
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(createProperty(new BigDecimal("150"))));
            when(reservationRepository.findByPropertyIdsAndDateRange(any(), any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of());

            // Anonymization passthrough
            when(anonymizationService.anonymize(any())).thenAnswer(inv -> inv.getArgument(0));

            // LLM response
            String aiJson = """
                [
                  {
                    "date": "2026-03-15",
                    "suggestedPrice": 175.00,
                    "explanation": "Weekend premium plus spring demand increase",
                    "confidence": 0.82,
                    "marketComparison": "10% above local average",
                    "factors": ["weekend", "spring season", "local event"]
                  }
                ]
                """;
            AiResponse aiResponse = new AiResponse(aiJson, 200, 100, 300, "claude-sonnet-4-20250514", "end_turn");
            when(anthropicProvider.chat(any())).thenReturn(aiResponse);
            when(anthropicProvider.name()).thenReturn("anthropic");

            List<AiPricingRecommendationDto> results = service.getAiPredictions(
                    PROPERTY_ID, ORG_ID, LocalDate.of(2026, 3, 15), LocalDate.of(2026, 3, 15));

            assertEquals(1, results.size());
            assertEquals(new BigDecimal("175.00"), results.get(0).suggestedPrice());
            assertEquals(0.82, results.get(0).confidence());
            assertEquals(3, results.get(0).factors().size());

            // Verify budget was checked and usage recorded
            verify(tokenBudgetService).requireBudget(ORG_ID, AiFeature.PRICING, KeySource.PLATFORM);
            verify(tokenBudgetService).recordUsage(eq(ORG_ID), eq(AiFeature.PRICING), eq("anthropic"), eq(aiResponse));
        }

        @Test
        void anonymizationCalled() {
            AiProperties.Features features = new AiProperties.Features();
            features.setPricingAi(true);
            when(aiProperties.getFeatures()).thenReturn(features);
            when(aiKeyResolver.resolve(ORG_ID, "anthropic")).thenReturn(PLATFORM_KEY);
            doNothing().when(tokenBudgetService).requireBudget(ORG_ID, AiFeature.PRICING, KeySource.PLATFORM);
            when(propertyRepository.findById(PROPERTY_ID))
                    .thenReturn(Optional.of(createProperty(new BigDecimal("100"))));
            when(reservationRepository.findByPropertyIdsAndDateRange(any(), any(), any(), eq(ORG_ID)))
                    .thenReturn(List.of());
            when(anonymizationService.anonymize(any())).thenReturn("anonymized prompt");

            String aiJson = "[{\"date\":\"2026-03-15\",\"suggestedPrice\":100.00,\"explanation\":\"ok\"," +
                    "\"confidence\":0.5,\"marketComparison\":\"avg\",\"factors\":[]}]";
            when(anthropicProvider.chat(any())).thenReturn(
                    new AiResponse(aiJson, 10, 5, 15, "claude-sonnet-4-20250514", "end_turn"));
            when(anthropicProvider.name()).thenReturn("anthropic");

            service.getAiPredictions(PROPERTY_ID, ORG_ID,
                    LocalDate.of(2026, 3, 15), LocalDate.of(2026, 3, 15));

            verify(anonymizationService).anonymize(any());
        }

        @Test
        void budgetExceeded_throwsException() {
            AiProperties.Features features = new AiProperties.Features();
            features.setPricingAi(true);
            when(aiProperties.getFeatures()).thenReturn(features);
            when(anthropicProvider.name()).thenReturn("anthropic");
            when(aiKeyResolver.resolve(ORG_ID, "anthropic")).thenReturn(PLATFORM_KEY);
            doThrow(new IllegalStateException("budget exceeded"))
                    .when(tokenBudgetService).requireBudget(ORG_ID, AiFeature.PRICING, KeySource.PLATFORM);

            assertThrows(IllegalStateException.class,
                    () -> service.getAiPredictions(PROPERTY_ID, ORG_ID,
                            LocalDate.now(), LocalDate.now().plusDays(3)));
        }
    }
}
