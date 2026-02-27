package com.clenzy.dto;

import com.clenzy.model.*;
import java.time.LocalDateTime;

public record ConversationDto(
    Long id,
    Long guestId,
    String guestName,
    Long propertyId,
    String propertyName,
    Long reservationId,
    ConversationChannel channel,
    ConversationStatus status,
    String subject,
    String lastMessagePreview,
    LocalDateTime lastMessageAt,
    String assignedToKeycloakId,
    boolean unread,
    int messageCount,
    LocalDateTime createdAt
) {
    public static ConversationDto from(Conversation c) {
        return new ConversationDto(
            c.getId(),
            c.getGuest() != null ? c.getGuest().getId() : null,
            c.getGuest() != null ? c.getGuest().getFullName() : null,
            c.getProperty() != null ? c.getProperty().getId() : null,
            c.getProperty() != null ? c.getProperty().getName() : null,
            c.getReservation() != null ? c.getReservation().getId() : null,
            c.getChannel(),
            c.getStatus(),
            c.getSubject(),
            c.getLastMessagePreview(),
            c.getLastMessageAt(),
            c.getAssignedToKeycloakId(),
            c.isUnread(),
            c.getMessageCount(),
            c.getCreatedAt()
        );
    }
}
