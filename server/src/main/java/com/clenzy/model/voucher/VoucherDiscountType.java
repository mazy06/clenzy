package com.clenzy.model.voucher;

/**
 * Type de remise appliquee par un voucher.
 *
 * <p>La semantique de {@code discount_value} depend de ce type :</p>
 * <ul>
 *   <li>{@link #PERCENTAGE} : pourcentage (1-100) applique sur subtotal.</li>
 *   <li>{@link #FIXED_AMOUNT} : montant fixe en euros deduit du subtotal.</li>
 *   <li>{@link #FREE_NIGHTS} : nombre de nuits gratuites (les N moins cheres
 *       du sejour). Reserve V2 si on a le temps — implementation plus complexe
 *       car necessite l'acces a la granularite per-nuit du quote.</li>
 * </ul>
 */
public enum VoucherDiscountType {
    PERCENTAGE,
    FIXED_AMOUNT,
    FREE_NIGHTS
}
