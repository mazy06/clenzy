package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record LedgerEntryDto(
    Long id,
    String entryType,
    BigDecimal amount,
    String currency,
    BigDecimal balanceAfter,
    String referenceType,
    String referenceId,
    String description,
    LocalDateTime createdAt
) {}
