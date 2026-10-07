package com.clenzy.dto;

/**
 * Upsert de la config d'un provider d'activites. {@code apiKey} nullable :
 * s'il est vide, la cle existante est conservee (on ne l'ecrase pas avec du vide).
 */
public record UpsertActivityConfigRequest(
    String apiKey,
    String affiliateId,
    boolean enabled,
    /** Part Baitly (%) réservée au staff. null conserve le taux existant ; 0 supprime la retenue. */
    @jakarta.validation.constraints.DecimalMin("0")
    @jakarta.validation.constraints.DecimalMax("100")
    java.math.BigDecimal platformCommissionPct
) {}
