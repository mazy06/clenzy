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
    /** Frais OTA deduits, quand le contrat les met a la charge du proprietaire. Zero sinon. */
    BigDecimal totalOtaFees,
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
        /** Frais preleves par l'OTA sur ce sejour, s'ils sont a la charge du proprietaire. */
        BigDecimal otaFee,
        BigDecimal commission,
        BigDecimal net
    ) {}
}
