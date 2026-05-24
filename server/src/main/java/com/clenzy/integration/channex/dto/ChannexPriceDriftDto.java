package com.clenzy.integration.channex.dto;

import com.clenzy.integration.channex.model.ChannexPriceDrift;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * DTO d'un drift de prix Clenzy ↔ OTA — Phase 3.
 *
 * <p>Inclut le ratio d'ecart (en %) pre-calcule pour permettre a l'UI de
 * trier/filtrer par severite sans recalcul cote frontend.</p>
 */
public record ChannexPriceDriftDto(
    Long id,
    Long clenzyPropertyId,
    UUID mappingId,
    LocalDate driftDate,
    BigDecimal clenzyPrice,
    BigDecimal otaPrice,
    BigDecimal diffAmount,
    Double diffPercent,
    String currency,
    Instant detectedAt,
    String resolution,
    Instant resolvedAt,
    String resolvedBy
) {
    public static ChannexPriceDriftDto from(ChannexPriceDrift d) {
        BigDecimal diff = d.getClenzyPrice().subtract(d.getOtaPrice());
        double pct = 0.0;
        if (d.getOtaPrice() != null && d.getOtaPrice().signum() > 0) {
            pct = diff.doubleValue() / d.getOtaPrice().doubleValue() * 100.0;
        }
        return new ChannexPriceDriftDto(
            d.getId(),
            d.getClenzyPropertyId(),
            d.getMappingId(),
            d.getDriftDate(),
            d.getClenzyPrice(),
            d.getOtaPrice(),
            diff,
            pct,
            d.getCurrency(),
            d.getDetectedAt(),
            d.getResolution() != null ? d.getResolution().name() : null,
            d.getResolvedAt(),
            d.getResolvedBy()
        );
    }
}
