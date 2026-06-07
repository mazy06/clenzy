package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Taux de monétisation effectifs d'une org (résolus : override org ou défaut global).
 * Deux niveaux : commission plateforme (staff-only) et commission org/conciergerie (org-editable).
 */
public record MonetizationConfigDto(
        BigDecimal upsellPlatformFeePct,
        BigDecimal activityPlatformCommissionPct,
        BigDecimal upsellOrgCommissionPct,
        BigDecimal activityOrgCommissionPct) {}
