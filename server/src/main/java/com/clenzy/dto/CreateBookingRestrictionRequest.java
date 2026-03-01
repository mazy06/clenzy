package com.clenzy.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CreateBookingRestrictionRequest(
    @NotNull Long propertyId,
    @NotNull LocalDate startDate,
    @NotNull LocalDate endDate,
    Integer minStay,
    Integer maxStay,
    Boolean closedToArrival,
    Boolean closedToDeparture,
    Integer gapDays,
    Integer advanceNoticeDays,
    Integer[] daysOfWeek,
    Integer priority
) {}
