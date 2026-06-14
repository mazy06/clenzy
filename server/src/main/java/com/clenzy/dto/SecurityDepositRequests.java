package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Requêtes de l'API caution (Phase 4). Records, aucune entité JPA exposée (audit #5).
 */
public final class SecurityDepositRequests {

    private SecurityDepositRequests() {}

    /** Création d'une caution pour une réservation. */
    public record Create(Long reservationId, BigDecimal amount, String currency) {}

    /** Enregistrement d'un hold PSP placé (pré-autorisation). */
    public record Hold(String externalRef) {}

    /** Encaissement pour dommages (montant ≤ caution). */
    public record Capture(BigDecimal amount, String reason) {}
}
