package com.clenzy.dto;

import java.math.BigDecimal;

/** Synthèse des commissions d'activités d'une org (côté hôte). */
public record ActivityCommissionSummaryDto(
        BigDecimal totalGross,
        BigDecimal totalHostShare,
        BigDecimal totalPlatformShare,
        long count,
        String currency,
        java.util.List<CurrencyTotal> totalsByCurrency) {
    public record CurrencyTotal(String currency, BigDecimal expectedGross, BigDecimal receivedGross,
            BigDecimal hostShare, BigDecimal platformShare, long count) {}
}
