package com.clenzy.dto;

import java.time.LocalDate;

public record RegulatoryComplianceDto(
    Long propertyId,
    String propertyName,
    int year,
    int daysRented,
    int maxDays,
    int daysRemaining,
    boolean isCompliant,
    String registrationNumber,
    String alertMessage
) {}
