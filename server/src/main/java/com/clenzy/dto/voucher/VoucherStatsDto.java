package com.clenzy.dto.voucher;

import java.math.BigDecimal;

/**
 * Statistiques d'un voucher individuel.
 *
 * <p>Retourne par {@code GET /api/vouchers/{id}/analytics} et inclut dans
 * la {@link VoucherAnalyticsDto#topVouchers()}.</p>
 *
 * @param voucherId      identifiant du voucher
 * @param voucherName    nom interne (UI display sans aller chercher l'entite)
 * @param voucherCode    code texte (NULL pour AUTO_CAMPAIGN)
 * @param usageCount     nb d'applications sur la periode
 * @param totalGross     CA brut (somme des originalTotal)
 * @param totalDiscount  discount cumule (somme des discountApplied)
 * @param totalNet       CA net (somme des finalTotal)
 * @param avgDiscountPct pourcentage moyen de discount sur le brut, 2 decimales
 */
public record VoucherStatsDto(
    Long voucherId,
    String voucherName,
    String voucherCode,
    long usageCount,
    BigDecimal totalGross,
    BigDecimal totalDiscount,
    BigDecimal totalNet,
    BigDecimal avgDiscountPct
) {}
