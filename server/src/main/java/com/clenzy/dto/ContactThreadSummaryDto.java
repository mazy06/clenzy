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
    int totalMessages,
    /**
     * Fil de GROUPE : identifiant du fil. NULL pour un echange un-a-un, dont
     * la conversation se deduit de l'interlocuteur.
     */
    Long threadId,
    /** Intitule du fil de groupe — un groupe n'a pas d'« interlocuteur ». */
    String title,
    /** Noms des participants, l'appelant compris. */
    java.util.List<String> participantNames
) {

    /** Echange un-a-un : la forme historique, sans fil. */
    public static ContactThreadSummaryDto oneToOne(
            String counterpartKeycloakId, Long counterpartUserId,
            String counterpartFirstName, String counterpartLastName, String counterpartEmail,
            String counterpartProfilePictureUrl, LocalDateTime counterpartUpdatedAt,
            String lastMessagePreview, LocalDateTime lastMessageAt,
            long unreadCount, int totalMessages) {
        return new ContactThreadSummaryDto(counterpartKeycloakId, counterpartUserId,
                counterpartFirstName, counterpartLastName, counterpartEmail,
                counterpartProfilePictureUrl, counterpartUpdatedAt,
                lastMessagePreview, lastMessageAt, unreadCount, totalMessages,
                null, null, java.util.List.of());
    }
}
