package com.clenzy.dto;

/**
 * Upsert de la config d'un provider d'activites. {@code apiKey} nullable :
 * s'il est vide, la cle existante est conservee (on ne l'ecrase pas avec du vide).
 */
public record UpsertActivityConfigRequest(
    String apiKey,
    String affiliateId,
    boolean enabled,
    /** Part Baitly (%) sur la commission de ce programme. null = rien retenu. */
    java.math.BigDecimal platformCommissionPct
) {}
