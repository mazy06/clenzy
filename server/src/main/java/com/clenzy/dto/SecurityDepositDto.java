package com.clenzy.dto;

import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;

import java.math.BigDecimal;

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
    String reason
) {
    public static SecurityDepositDto from(SecurityDeposit d) {
        return new SecurityDepositDto(
            d.getId(), d.getReservationId(), d.getAmount(), d.getCapturedAmount(),
            d.getCurrency(), d.getStatus(), d.getExternalRef(), d.getReason());
    }
}
