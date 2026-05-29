package com.clenzy.service.voucher;

/**
 * Raisons pour lesquelles un voucher peut etre refuse lors de la validation
 * cote guest (au moment de l'application au booking).
 *
 * <p>Chaque code se traduit en frontend par un message i18n dedie permettant
 * d'expliquer au voyageur pourquoi le code n'est pas accepte (UX critique :
 * "Ce code expire" est plus actionable que "Code invalide").</p>
 */
public enum VoucherValidationError {

    /** Code introuvable dans la base pour cette org (ou tout simplement faute de frappe). */
    NOT_FOUND,

    /** Voucher trouve mais en statut DRAFT (pas encore active par le createur). */
    DRAFT_NOT_ACTIVE,

    /** Voucher en statut PAUSED par le createur. */
    PAUSED,

    /** Statut EXPIRED ou {@code valid_until} depasse. */
    EXPIRED,

    /** {@code valid_from} pas encore atteint. */
    NOT_YET_ACTIVE,

    /** Property cible ne fait pas partie du scope du voucher. */
    PROPERTY_NOT_IN_SCOPE,

    /** Sejour trop court (en-dessous de {@code min_stay_nights}). */
    MIN_STAY_NOT_MET,

    /** Sejour trop long (au-dessus de {@code max_stay_nights}). */
    MAX_STAY_EXCEEDED,

    /** Montant total avant discount inferieur a {@code min_total_amount}. */
    MIN_TOTAL_NOT_MET,

    /** Plafond global {@code max_uses_total} atteint. */
    USAGE_LIMIT_REACHED,

    /** Plafond par-guest {@code max_uses_per_guest} atteint pour ce {@code guest_email}. */
    GUEST_LIMIT_REACHED,

    /** Canal d'application incompatible avec {@code channel_scope}. */
    CHANNEL_NOT_ALLOWED,

    /** Inputs invalides (code vide/null, dates invalides, etc). */
    INVALID_INPUT
}
