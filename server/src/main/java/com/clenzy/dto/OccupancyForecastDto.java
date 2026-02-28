package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Prediction d'occupation pour une propriete a une date donnee.
 */
public record OccupancyForecastDto(
    Long propertyId,
    LocalDate date,
    double predictedOccupancy,   // 0.0 to 1.0
    double confidence,            // 0.0 to 1.0
    boolean isBooked,             // true if already booked
    String dayType,               // WEEKEND, WEEKDAY, HOLIDAY
    String season,                // HIGH, MID, LOW
    String reason                 // explanation
) {}
