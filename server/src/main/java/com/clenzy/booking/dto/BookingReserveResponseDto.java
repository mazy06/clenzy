package com.clenzy.booking.dto;

import com.clenzy.service.voucher.VoucherValidationError;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Reponse apres creation d'une reservation PENDING ou CONFIRMED (si autoConfirm).
 *
 * <p>Le {@code total} reflete le montant FINAL (post-discount si voucher
 * applique). Le {@code originalTotal} (si voucher applique) est le montant
 * pre-discount, et {@code discountAmount} le montant deduit.</p>
 *
 * @param voucherApplied  true si le voucher a ete applique avec succes.
 * @param voucherRejectedReason  code d'erreur si le voucher fourni a ete refuse
 *        au moment du booking (degradation gracieuse, la reservation a
 *        quand-meme ete creee sans discount). NULL si pas de voucher ou
 *        applique avec succes.
 */
public record BookingReserveResponseDto(
    String reservationCode,
    String status,
    String propertyName,
    LocalDate checkIn,
    LocalDate checkOut,
    BigDecimal total,
    String currency,
    LocalDateTime expiresAt,
    boolean requiresPayment,
    boolean voucherApplied,
    BigDecimal originalTotal,
    BigDecimal discountAmount,
    VoucherValidationError voucherRejectedReason
) {
    /** Helper pour le cas "pas de voucher demande" (constructeur simplifie). */
    public static BookingReserveResponseDto withoutVoucher(
        String reservationCode, String status, String propertyName,
        LocalDate checkIn, LocalDate checkOut, BigDecimal total, String currency,
        LocalDateTime expiresAt, boolean requiresPayment
    ) {
        return new BookingReserveResponseDto(
            reservationCode, status, propertyName, checkIn, checkOut, total,
            currency, expiresAt, requiresPayment, false, null, null, null
        );
    }

    /** Helper pour le cas "voucher applique avec succes". */
    public static BookingReserveResponseDto withVoucherApplied(
        String reservationCode, String status, String propertyName,
        LocalDate checkIn, LocalDate checkOut, BigDecimal finalTotal, String currency,
        LocalDateTime expiresAt, boolean requiresPayment,
        BigDecimal originalTotal, BigDecimal discountAmount
    ) {
        return new BookingReserveResponseDto(
            reservationCode, status, propertyName, checkIn, checkOut, finalTotal,
            currency, expiresAt, requiresPayment, true, originalTotal, discountAmount, null
        );
    }

    /** Helper pour "voucher demande mais refuse" (UX : booking creee sans discount). */
    public static BookingReserveResponseDto withVoucherRejected(
        String reservationCode, String status, String propertyName,
        LocalDate checkIn, LocalDate checkOut, BigDecimal total, String currency,
        LocalDateTime expiresAt, boolean requiresPayment,
        VoucherValidationError reason
    ) {
        return new BookingReserveResponseDto(
            reservationCode, status, propertyName, checkIn, checkOut, total,
            currency, expiresAt, requiresPayment, false, null, null, reason
        );
    }
}
