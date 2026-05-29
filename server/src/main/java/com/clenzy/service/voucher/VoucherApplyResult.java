package com.clenzy.service.voucher;

import java.math.BigDecimal;

/**
 * Resultat du calcul d'un voucher applique sur un subtotal donne.
 *
 * <p>Materialise l'avant/apres : {@code originalTotal} reste le montant
 * publie par le PriceEngine, {@code discountApplied} est ce qui a ete deduit,
 * {@code finalTotal} est ce que le guest paiera reellement.</p>
 *
 * <p>Ce record est ce qu'on injecte dans {@code Reservation} (champs
 * {@code original_total}, {@code discount_amount}, {@code voucher_code},
 * {@code booking_voucher_id}) lors de la confirmation du booking, et dans
 * {@code VoucherUsage} pour l'audit.</p>
 *
 * @param voucherId      ID du {@code BookingVoucher} applique
 * @param voucherCode    code texte (denormalise pour audit meme si voucher supprime)
 * @param originalTotal  total AVANT le discount
 * @param discountApplied montant deduit (jamais > originalTotal)
 * @param finalTotal     {@code originalTotal - discountApplied}, jamais negatif
 */
public record VoucherApplyResult(
    Long voucherId,
    String voucherCode,
    BigDecimal originalTotal,
    BigDecimal discountApplied,
    BigDecimal finalTotal
) {}
