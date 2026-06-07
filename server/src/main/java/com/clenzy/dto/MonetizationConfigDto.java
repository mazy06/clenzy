package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Taux de monétisation effectifs d'une org (valeurs résolues : override org ou
 * défaut global). {@code upsellPlatformFeePct} = part plateforme sur les upsells ;
 * {@code activityHostSharePct} = part hôte sur les commissions d'activités.
 */
public record MonetizationConfigDto(
        BigDecimal upsellPlatformFeePct,
        BigDecimal activityHostSharePct) {}
