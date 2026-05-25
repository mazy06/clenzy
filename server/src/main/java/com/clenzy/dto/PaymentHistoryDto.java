package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * DTO pour une ligne de l'historique des paiements.
 * Represente soit une intervention soit une reservation ayant un montant > 0.
 *
 * <p><b>Description vs sub-description</b> : la colonne PROPRIETE etant
 * deja affichee separement dans le tableau, {@code description} ne doit
 * PAS contenir le nom de la propriete (redondance visuelle). Le frontend
 * peut afficher {@code subDescription} en caption sous le titre principal
 * pour les informations secondaires (dates de sejour, nombre de nuits,
 * source de la reservation, etc.).</p>
 */
public class PaymentHistoryDto {
    public Long id;
    public Long referenceId;          // ID de l'intervention ou de la reservation
    /**
     * Titre court de la ligne — ne contient pas le nom de la propriete (deja
     * affiche dans la colonne PROPRIETE). Exemples :
     *   - Service Request : "Menage Airbnb", "Maintenance plomberie"
     *   - Reservation     : "Airbnb · 4 nuits"
     *   - Intervention    : titre defini par le createur
     */
    public String description;
    /**
     * Description secondaire facultative (caption sous le titre). Utilisee
     * surtout pour les reservations afin d'afficher les dates de sejour
     * sans surcharger la description principale. Format libre, ex:
     *   - Reservation : "10/05 → 15/05"
     *   - Service Request : null (rien de pertinent a montrer en sous-ligne)
     */
    public String subDescription;
    public String propertyName;
    public BigDecimal amount;
    public String currency = "EUR";
    public String status;             // PAID, PENDING, PROCESSING, FAILED, REFUNDED, CANCELLED
    public String type = "INTERVENTION"; // INTERVENTION or RESERVATION or SERVICE_REQUEST
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
