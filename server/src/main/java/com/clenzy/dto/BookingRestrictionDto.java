package com.clenzy.dto;

import com.clenzy.model.BookingRestriction;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record BookingRestrictionDto(
    Long id,
    Long propertyId,
    LocalDate startDate,
    LocalDate endDate,
    Integer minStay,
    Integer maxStay,
    Boolean closedToArrival,
    Boolean closedToDeparture,
    Integer gapDays,
    Integer advanceNoticeDays,
    Integer[] daysOfWeek,
    Integer priority,
    LocalDateTime createdAt
) {
    public static BookingRestrictionDto from(BookingRestriction r) {
        return new BookingRestrictionDto(
            r.getId(), r.getProperty().getId(), r.getStartDate(), r.getEndDate(),
            r.getMinStay(), r.getMaxStay(), r.getClosedToArrival(), r.getClosedToDeparture(),
            r.getGapDays(), r.getAdvanceNoticeDays(), r.getDaysOfWeek(), r.getPriority(),
            r.getCreatedAt()
        );
    }
}
