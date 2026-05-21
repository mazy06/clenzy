package com.clenzy.dto;

import java.time.LocalDateTime;

/**
 * Resume d'une conversation (thread) entre l'utilisateur courant et un interlocuteur.
 * Les messages sont groupes par paire (sender, recipient) sans threadId explicite.
 */
public record ContactThreadSummaryDto(
    String counterpartKeycloakId,
    /** Numeric (Long) id of the counterpart user — used to build the avatar URL. */
    Long counterpartUserId,
    String counterpartFirstName,
    String counterpartLastName,
    String counterpartEmail,
    /** Public URL of the counterpart's avatar; null when they have no photo. */
    String counterpartProfilePictureUrl,
    /** Updated-at of the counterpart user — used as cache-buster for the avatar URL. */
    LocalDateTime counterpartUpdatedAt,
    String lastMessagePreview,
    LocalDateTime lastMessageAt,
    long unreadCount,
    int totalMessages
) {}
