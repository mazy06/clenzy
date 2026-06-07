package com.clenzy.dto;

import java.math.BigDecimal;

/** Synthèse des commissions d'activités d'une org (côté hôte). */
public record ActivityCommissionSummaryDto(
        BigDecimal totalGross,
        BigDecimal totalHostShare,
        BigDecimal totalPlatformShare,
        long count,
        String currency) {}
