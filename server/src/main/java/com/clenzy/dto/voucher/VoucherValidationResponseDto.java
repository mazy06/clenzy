package com.clenzy.dto.voucher;

import com.clenzy.service.voucher.VoucherValidationError;

import java.math.BigDecimal;

/**
 * Reponse a une validation cote guest.
 *
 * <p>{@code valid=true} : le voucher est applicable, {@code discountAmount}
 * et {@code finalTotal} sont remplis pour preview UI. {@code valid=false} :
 * {@code errorCode} et {@code errorMessage} expliquent le refus (traduisible
 * en frontend selon {@link VoucherValidationError}).</p>
 */
public record VoucherValidationResponseDto(
    boolean valid,
    /** Snapshot du code valide (echo, pour l'UI). */
    String code,
    /** Discount calcule (NULL si invalid). */
    BigDecimal discountAmount,
    /** Total final apres discount (NULL si invalid). */
    BigDecimal finalTotal,
    /** Code d'erreur enum pour traduction i18n cote frontend. NULL si valid. */
    VoucherValidationError errorCode,
    /** Message en clair pour les logs / debug. NULL si valid. */
    String errorMessage
) {

    public static VoucherValidationResponseDto valid(String code, BigDecimal discount, BigDecimal finalTotal) {
        return new VoucherValidationResponseDto(true, code, discount, finalTotal, null, null);
    }

    public static VoucherValidationResponseDto invalid(VoucherValidationError error, String message) {
        return new VoucherValidationResponseDto(false, null, null, null, error, message);
    }
}
