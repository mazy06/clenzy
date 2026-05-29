package com.clenzy.service.voucher;

import com.clenzy.model.BookingVoucher;

/**
 * Resultat d'une validation de voucher cote guest (au moment de l'application
 * au booking, avant la confirmation).
 *
 * <p>Type sealed pour matcher exhaustivement les deux issues possibles dans
 * les services consumers (pattern matching Java 21+).</p>
 *
 * <p><b>Pourquoi pas une exception ?</b> Les refus sont des cas metier
 * attendus (faute de frappe, code expire, limite atteinte) qui doivent
 * remonter un message exploitable a l'utilisateur sans pollution de logs.
 * Les exceptions sont reservees aux violations de regles d'autorisation ou
 * aux echecs techniques.</p>
 */
public sealed interface VoucherValidationResult {

    /**
     * Voucher trouve et applicable. Le caller peut ensuite invoquer
     * {@code VoucherEngine.apply()} pour calculer le discount.
     */
    record Valid(BookingVoucher voucher) implements VoucherValidationResult {}

    /**
     * Voucher refuse. Contient la raison codee (pour traduction i18n) et un
     * message en clair (pour les logs).
     */
    record Invalid(VoucherValidationError reason, String message) implements VoucherValidationResult {}
}
