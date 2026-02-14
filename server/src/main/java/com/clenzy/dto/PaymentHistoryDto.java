package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * DTO pour une ligne de l'historique des paiements.
 * Represente une intervention ayant un cout estime (estimatedCost > 0).
 */
public class PaymentHistoryDto {
    public Long id;
    public Long interventionId;
    public String interventionTitle;
    public String propertyName;
    public BigDecimal amount;
    public String currency = "EUR";
    public String status;           // PAID, PENDING, PROCESSING, FAILED, REFUNDED, CANCELLED
    public String stripeSessionId;
    public String transactionDate;  // paidAt si PAID, sinon startTime/createdAt
    public String createdAt;
    public String hostName;         // Nom du requestor (visible ADMIN/MANAGER)
    public Long hostId;             // ID du requestor
}
