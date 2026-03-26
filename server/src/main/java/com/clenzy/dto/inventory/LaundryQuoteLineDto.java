package com.clenzy.dto.inventory;

import java.math.BigDecimal;

public record LaundryQuoteLineDto(
        String key,
        String label,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal lineTotal
) {}
