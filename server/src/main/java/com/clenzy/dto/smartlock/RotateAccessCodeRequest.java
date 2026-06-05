package com.clenzy.dto.smartlock;

import java.time.LocalDateTime;

/**
 * Corps optionnel d'une rotation manuelle de code. Tous les champs sont facultatifs :
 * sans fenetre, le service applique une validite par defaut ; {@code reservationId}
 * relie le code a une reservation (audit).
 */
public record RotateAccessCodeRequest(
        LocalDateTime validFrom,
        LocalDateTime validUntil,
        Long reservationId
) {
}
