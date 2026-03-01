package com.clenzy.dto;

import java.time.LocalDateTime;

/**
 * Resume d'une conversation (thread) entre l'utilisateur courant et un interlocuteur.
 * Les messages sont groupes par paire (sender, recipient) sans threadId explicite.
 */
public record ContactThreadSummaryDto(
    String counterpartKeycloakId,
    String counterpartFirstName,
    String counterpartLastName,
    String counterpartEmail,
    String lastMessagePreview,
    LocalDateTime lastMessageAt,
    long unreadCount,
    int totalMessages
) {}
