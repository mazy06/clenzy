package com.clenzy.service.messaging;

/**
 * Requete d'envoi de message a un voyageur.
 * Contient les informations necessaires pour tous les canaux (email, WhatsApp, SMS).
 */
public record MessageDeliveryRequest(
    String recipientEmail,
    String recipientPhone,
    String recipientName,
    String subject,
    String htmlBody,
    String plainBody,
    String language
) {}
