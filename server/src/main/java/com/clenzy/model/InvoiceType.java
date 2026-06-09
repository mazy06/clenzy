package com.clenzy.model;

/**
 * Nature d'une facture, selon le destinataire et l'objet.
 *
 * <ul>
 *   <li>{@link #GUEST} — facture de séjour émise au client (voyageur). Comportement historique.</li>
 *   <li>{@link #COMMISSION} — facture de commission de gestion émise par la conciergerie
 *       AU propriétaire (taxonomie OTA : OWNER_COLLECTS = créance, CONCIERGE_COLLECTS = retenue
 *       sur reversement).</li>
 * </ul>
 *
 * Une réservation peut porter au plus une facture GUEST et une facture COMMISSION
 * (cas CONCIERGE_COLLECTS) — l'unicité se résout par (reservationId, invoiceType).
 */
public enum InvoiceType {
    GUEST,
    COMMISSION
}
