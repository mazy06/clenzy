package com.clenzy.booking.dto;

import java.math.BigDecimal;

/**
 * Résultat d'une annulation self-service par le voyageur.
 *
 * @param status           "cancelled" (annulée + remboursement éventuel émis) ou
 *                         "already_cancelled" (idempotent : déjà annulée).
 * @param refundAmount     montant remboursé (selon la politique), 0 si non remboursable.
 * @param currency         devise du remboursement (null si non applicable).
 * @param policyType       politique appliquée (FLEXIBLE/MODERATE/STRICT…), null si non applicable.
 * @param refundPercentage pourcentage remboursé selon la politique.
 */
public record CancellationResultDto(
        String status,
        BigDecimal refundAmount,
        String currency,
        String policyType,
        int refundPercentage
) {}
