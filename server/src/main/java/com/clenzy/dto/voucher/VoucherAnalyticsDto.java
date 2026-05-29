package com.clenzy.dto.voucher;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Aggregation analytics cote PMS host : vue d'ensemble de la performance des
 * vouchers de l'org sur une periode donnee.
 *
 * <p>Le caller fournit {@code from} et {@code to} (ou des defauts cote
 * service : 30 derniers jours). Les totaux sont en EUR (string pour
 * eviter les pertes de precision JS).</p>
 *
 * <p>{@code topVouchers} : top 5 vouchers de la periode tries par
 * {@code totalGross} desc (CA brut genere). Permet d'identifier les
 * campagnes les plus performantes.</p>
 *
 * @param from              debut de la fenetre (ISO 8601)
 * @param to                fin de la fenetre (ISO 8601)
 * @param totalUsages       nombre d'applications de voucher sur la periode
 * @param totalGross        CA brut (somme des originalTotal)
 * @param totalDiscount     discount cumule (somme des discountApplied)
 * @param totalNet          CA net apres discount (somme des finalTotal)
 * @param activeVouchersCount nombre de vouchers en statut ACTIVE actuellement
 * @param topVouchers       top 5 vouchers par CA brut sur la periode
 */
public record VoucherAnalyticsDto(
    Instant from,
    Instant to,
    long totalUsages,
    BigDecimal totalGross,
    BigDecimal totalDiscount,
    BigDecimal totalNet,
    long activeVouchersCount,
    List<VoucherStatsDto> topVouchers
) {}
