package com.clenzy.model.voucher;

/**
 * Type de declenchement d'un voucher.
 *
 * <ul>
 *   <li>{@link #MANUAL_CODE} : le guest saisit le code dans le booking engine (ou
 *       le code est pre-rempli via lien partage).</li>
 *   <li>{@link #AUTO_CAMPAIGN} : le voucher s'applique automatiquement sur les
 *       dates eligibles, sans saisie de code (campagne marketing globale).</li>
 * </ul>
 */
public enum VoucherType {
    MANUAL_CODE,
    AUTO_CAMPAIGN
}
