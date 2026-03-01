package com.clenzy.dto;

/**
 * Evenement WebSocket pour les messages de contact internes.
 * Transporte le payload complet pour un affichage instantane cote client.
 */
public record ContactMessageEvent(
        String type,                    // "NEW_MESSAGE", "STATUS_UPDATE"
        Long messageId,
        String senderKeycloakId,
        String recipientKeycloakId,
        Long organizationId,
        ContactMessageDto message       // payload complet pour affichage direct
) {}
