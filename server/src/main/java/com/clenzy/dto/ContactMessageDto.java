package com.clenzy.dto;

import com.clenzy.model.ContactMessage;
import com.clenzy.util.StringUtils;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO immutable pour un message de contact.
 */
public record ContactMessageDto(
        Long id,
        String senderId,
        String senderName,
        String recipientId,
        String recipientName,
        String subject,
        String message,
        String priority,
        String category,
        String status,
        ContactUserDto sender,
        ContactUserDto recipient,
        List<ContactAttachmentDto> attachments,
        LocalDateTime createdAt,
        LocalDateTime deliveredAt,
        LocalDateTime readAt,
        LocalDateTime repliedAt,
        LocalDateTime archivedAt,
        boolean archived
) {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * Construit un DTO a partir de l'entite JPA.
     */
    public static ContactMessageDto fromEntity(ContactMessage m) {
        String sName = StringUtils.firstNonBlank(m.getSenderFirstName(), "Utilisateur");
        String sLast = StringUtils.firstNonBlank(m.getSenderLastName(), "");
        String rName = StringUtils.firstNonBlank(m.getRecipientFirstName(), "Utilisateur");
        String rLast = StringUtils.firstNonBlank(m.getRecipientLastName(), "");

        return new ContactMessageDto(
                m.getId(),
                m.getSenderKeycloakId(),
                (sName + " " + sLast).trim(),
                m.getRecipientKeycloakId(),
                (rName + " " + rLast).trim(),
                m.getSubject(),
                m.getMessage(),
                m.getPriority().name(),
                m.getCategory().name(),
                m.getStatus().name(),
                new ContactUserDto(m.getSenderKeycloakId(), sName, sLast, m.getSenderEmail()),
                new ContactUserDto(m.getRecipientKeycloakId(), rName, rLast, m.getRecipientEmail()),
                parseAttachments(m.getAttachments()),
                m.getCreatedAt(),
                m.getDeliveredAt(),
                m.getReadAt(),
                m.getRepliedAt(),
                m.getArchivedAt(),
                m.isArchived()
        );
    }

    private static List<ContactAttachmentDto> parseAttachments(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return MAPPER.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }
}
