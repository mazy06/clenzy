package com.clenzy.booking.dto;

import java.math.BigDecimal;

/**
 * Résultat d'une annulation self-service par le voyageur.
 *
 * @param status           "cancelled" (annulée + remboursement éventuel émis) ou
 *                         "already_cancelled" (idempotent : déjà annulée).
 * @param refundAmount     montant demandé selon la politique, jamais une preuve de remboursement.
 * @param currency         devise du remboursement (null si non applicable).
 * @param policyType       politique appliquée (FLEXIBLE/MODERATE/STRICT…), null si non applicable.
 * @param refundPercentage pourcentage remboursé selon la politique.
 */
public record CancellationResultDto(
        String status,
        BigDecimal refundAmount,
        String currency,
        String policyType,
        int refundPercentage,
        String refundStatus,
        BigDecimal refundedAmount
) {
    public CancellationResultDto(String status, BigDecimal refundAmount, String currency,
                                 String policyType, int refundPercentage) {
        this(status, refundAmount, currency, policyType, refundPercentage, "NONE", BigDecimal.ZERO);
    }
}
