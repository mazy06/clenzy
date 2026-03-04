package com.clenzy.integration.hubspot.dto;

/**
 * DTO pour un ticket HubSpot.
 *
 * @param subject   sujet du ticket
 * @param content   description du ticket
 * @param priority  niveau de priorite
 * @param pipeline  identifiant du pipeline HubSpot
 * @param stage     etape dans le pipeline
 * @param contactId identifiant du contact associe
 */
public record HubSpotTicketDto(
    String subject,
    String content,
    Priority priority,
    String pipeline,
    String stage,
    String contactId
) {

    public enum Priority {
        LOW, MEDIUM, HIGH, URGENT
    }
}
