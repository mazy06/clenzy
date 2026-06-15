package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Apercu du remboursement applicable si la reservation etait annulee maintenant, selon la
 * politique d'annulation de la propriete (CLZ Domaine 2 — politiques d'annulation appliquees).
 *
 * @param policyConfigured {@code false} si aucune politique n'est configuree pour la propriete
 *                         (le defaut FLEXIBLE a alors ete applique).
 */
public record CancellationRefundPreviewDto(
        Long reservationId,
        String policyType,
        int refundPercentage,
        BigDecimal refundAmount,
        BigDecimal nonRefundableAmount,
        String currency,
        long daysBeforeCheckIn,
        boolean policyConfigured,
        String explanation
) {}
