package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * DTO pour une ligne de l'historique des paiements.
 * Represente soit une intervention soit une reservation ayant un montant > 0.
 */
public class PaymentHistoryDto {
    public Long id;
    public Long referenceId;          // ID de l'intervention ou de la reservation
    public String description;        // Titre de l'intervention ou description de la reservation
    public String propertyName;
    public BigDecimal amount;
    public String currency = "EUR";
    public String status;             // PAID, PENDING, PROCESSING, FAILED, REFUNDED, CANCELLED
    public String type = "INTERVENTION"; // INTERVENTION or RESERVATION
    public String stripeSessionId;
    public String transactionDate;    // paidAt si PAID, sinon startTime/createdAt
    public String createdAt;
    public String hostName;           // Nom du requestor / guest
    public Long hostId;               // ID du requestor (null pour reservations)
    public String guestEmail;         // Email du guest (reservations uniquement)

    // Backward-compat aliases — the frontend may still read these for a brief period
    /** @deprecated use referenceId */
    public Long getInterventionId() { return referenceId; }
    /** @deprecated use description */
    public String getInterventionTitle() { return description; }
}
