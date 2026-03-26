package com.clenzy.dto.inventory;

import java.math.BigDecimal;
import java.util.List;

public record LaundryQuoteDto(
        Long id,
        Long propertyId,
        Long reservationId,
        String status,
        List<LaundryQuoteLineDto> lines,
        BigDecimal totalHt,
        String currency,
        String generatedAt,
        String confirmedAt,
        String notes
) {}
