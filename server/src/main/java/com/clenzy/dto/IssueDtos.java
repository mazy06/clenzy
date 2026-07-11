package com.clenzy.dto;

import com.clenzy.model.Issue.IssueSeverity;
import com.clenzy.model.Issue.IssueStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTOs des anomalies terrain (Moteur Ménage 3C / P10).
 * Records immutables — jamais d'entité JPA exposée (règle audit n°5).
 */
public final class IssueDtos {

    private IssueDtos() {
    }

    public record IssueDto(
            Long id,
            Long propertyId,
            String propertyName,
            Long sourceInterventionId,
            Long reportedById,
            String reportedByName,
            String title,
            String description,
            String category,
            IssueSeverity severity,
            IssueStatus status,
            BigDecimal suggestedCost,
            Long convertedServiceRequestId,
            String dismissReason,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {
    }

    /**
     * Création — {@code propertyId} OU {@code sourceInterventionId} requis
     * (le logement est dérivé de l'intervention quand seule celle-ci est fournie).
     */
    public record CreateIssueRequest(
            Long propertyId,
            Long sourceInterventionId,
            @NotBlank @Size(max = 150) String title,
            @Size(max = 5000) String description,
            @Size(max = 80) String category,
            IssueSeverity severity) {
    }

    /** Qualification par le gestionnaire — champs null = inchangés. */
    public record QualifyIssueRequest(
            @Size(max = 80) String category,
            IssueSeverity severity,
            BigDecimal suggestedCost) {
    }

    public record DismissIssueRequest(@Size(max = 500) String reason) {
    }
}
