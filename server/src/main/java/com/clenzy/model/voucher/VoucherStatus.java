package com.clenzy.model.voucher;

/**
 * Etat du cycle de vie d'un voucher.
 *
 * <ul>
 *   <li>{@link #DRAFT} : en cours de creation, non actif (visible uniquement
 *       par le createur dans son UI).</li>
 *   <li>{@link #ACTIVE} : actif et utilisable.</li>
 *   <li>{@link #PAUSED} : temporairement desactive sans suppression (preserve
 *       l'historique d'usage et permet une reactivation rapide).</li>
 *   <li>{@link #EXPIRED} : statut applique par le scheduler quotidien quand
 *       {@code valid_until < now}. Reste en base pour analytics historiques.</li>
 * </ul>
 */
public enum VoucherStatus {
    DRAFT,
    ACTIVE,
    PAUSED,
    EXPIRED
}
