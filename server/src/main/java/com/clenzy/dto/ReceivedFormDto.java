package com.clenzy.dto;

import com.clenzy.model.ReceivedForm;

import java.time.LocalDateTime;

/**
 * Representation REST d'un formulaire recu (devis, maintenance, support).
 * Shape JSON strictement identique a l'entite {@link ReceivedForm} historiquement
 * exposee par ReceivedFormController (audit regle 5 : jamais d'entite JPA en sortie).
 */
public record ReceivedFormDto(
        Long id,
        Long organizationId,
        String formType,
        String fullName,
        String email,
        String phone,
        String city,
        String postalCode,
        String subject,
        String payload,
        String status,
        String ipAddress,
        LocalDateTime createdAt,
        LocalDateTime readAt,
        LocalDateTime processedAt
) {
    public static ReceivedFormDto fromEntity(ReceivedForm form) {
        return new ReceivedFormDto(
                form.getId(),
                form.getOrganizationId(),
                form.getFormType(),
                form.getFullName(),
                form.getEmail(),
                form.getPhone(),
                form.getCity(),
                form.getPostalCode(),
                form.getSubject(),
                form.getPayload(),
                form.getStatus(),
                form.getIpAddress(),
                form.getCreatedAt(),
                form.getReadAt(),
                form.getProcessedAt()
        );
    }
}
