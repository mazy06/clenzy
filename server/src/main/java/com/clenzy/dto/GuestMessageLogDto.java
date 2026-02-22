package com.clenzy.dto;

import com.clenzy.model.GuestMessageLog;

public record GuestMessageLogDto(
    Long id,
    Long reservationId,
    Long guestId,
    String guestName,
    Long templateId,
    String templateName,
    String channel,
    String recipient,
    String subject,
    String status,
    String errorMessage,
    String sentAt
) {
    public static GuestMessageLogDto fromEntity(GuestMessageLog e) {
        return new GuestMessageLogDto(
            e.getId(),
            e.getReservationId(),
            e.getGuestId(),
            e.getGuest() != null ? e.getGuest().getFullName() : null,
            e.getTemplateId(),
            e.getTemplate() != null ? e.getTemplate().getName() : null,
            e.getChannel().getValue(),
            e.getRecipient(),
            e.getSubject(),
            e.getStatus().getValue(),
            e.getErrorMessage(),
            e.getSentAt() != null ? e.getSentAt().toString() : null
        );
    }
}
