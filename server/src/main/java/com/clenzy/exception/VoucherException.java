package com.clenzy.exception;

/**
 * Exception levee par le {@code VoucherEngine} ou le {@code BookingVoucherService}
 * pour signaler une violation de regle metier liee aux vouchers.
 *
 * <p>Cas typiques : tentative de creation par une org sans
 * {@code has_voucher_contract}, voucher introuvable, race condition sur
 * {@code max_uses_total}, etc.</p>
 *
 * <p>Pour les erreurs de validation cote guest (code invalide, expire,
 * limite atteinte, etc.), on prefere {@code VoucherValidationResult.Invalid}
 * (sans exception) car ces cas sont attendus et doivent retourner un message
 * exploitable a l'utilisateur sans tracer la stack.</p>
 */
public class VoucherException extends RuntimeException {
    public VoucherException(String message) {
        super(message);
    }

    public VoucherException(String message, Throwable cause) {
        super(message, cause);
    }
}
