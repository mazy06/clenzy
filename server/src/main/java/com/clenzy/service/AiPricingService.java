package com.clenzy.service;

import com.clenzy.dto.PricePredictionDto;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.ReservationRepository;
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

    public AiPricingService(ReservationRepository reservationRepository,
                             PropertyRepository propertyRepository,
                             RateOverrideRepository rateOverrideRepository) {
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.rateOverrideRepository = rateOverrideRepository;
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
}
