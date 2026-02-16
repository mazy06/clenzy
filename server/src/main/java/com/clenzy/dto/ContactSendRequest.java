package com.clenzy.dto;

/**
 * DTO pour l'envoi d'un message de contact via JSON (sans pieces jointes).
 */
public record ContactSendRequest(
        String recipientId,
        String subject,
        String message,
        String priority,
        String category
) {}
