package com.clenzy.dto.yield;

import java.math.BigDecimal;

/**
 * Config yield de l'org : kill-switch + mode progressif (SIMULATION / SUGGEST / AUTO)
 * + automatisations déterministes R2 (orphan gap pricing, min-stay dynamique —
 * opt-in, OFF par défaut, réversibles).
 *
 * <p>Les champs R2 sont des wrappers : {@code null} en entrée = « inchangé »
 * (compatibilité avec les clients qui ne les envoient pas — un PUT partiel ne
 * doit jamais désactiver silencieusement une automatisation).</p>
 */
public record YieldConfigDto(
    boolean enabled,
    String mode,
    Boolean orphanGapEnabled,
    Integer orphanGapMaxNights,
    BigDecimal orphanGapDiscountPct,
    Boolean minStayAutoEnabled,
    Integer minStayReduceWithinDays,
    Integer minStayReducedValue
) {}
