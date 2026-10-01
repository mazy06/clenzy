package com.clenzy.dto;

import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Vue d'une caution (Phase 4). DTO record, jamais l'entité JPA exposée (audit #5).
 */
public record SecurityDepositDto(
    Long id,
    Long reservationId,
    BigDecimal amount,
    BigDecimal capturedAmount,
    String currency,
    SecurityDepositStatus status,
    String externalRef,
    String reason,
    /** Fin de validité du hold en cours (capture_before Stripe) — capturer avant cette date. */
    Instant holdExpiresAt,
    /** Dernier refus de pré-autorisation (code Stripe), null si aucun. */
    String holdError
) {
    public static SecurityDepositDto from(SecurityDeposit d) {
        return new SecurityDepositDto(
            d.getId(), d.getReservationId(), d.getAmount(), d.getCapturedAmount(),
            d.getCurrency(), d.getStatus(), d.getExternalRef(), d.getReason(),
            d.getHoldExpiresAt(), d.getHoldError());
    }
}
