package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record OwnerStatementDto(
    Long ownerId,
    String ownerName,
    LocalDate periodStart,
    LocalDate periodEnd,
    BigDecimal totalRevenue,
    BigDecimal totalCommissions,
    BigDecimal totalExpenses,
    BigDecimal netAmount,
    List<StatementLineDto> lines
) {
    public record StatementLineDto(
        LocalDate date,
        String description,
        String propertyName,
        String type,
        BigDecimal amount,
        BigDecimal commission,
        BigDecimal net
    ) {}
}
