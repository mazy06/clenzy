package com.clenzy.dto;

import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationExecutionStatus;
import java.time.LocalDateTime;

public record AutomationExecutionDto(
    Long id,
    Long ruleId,
    String ruleName,
    Long reservationId,
    AutomationExecutionStatus status,
    String errorMessage,
    LocalDateTime scheduledAt,
    LocalDateTime executedAt,
    String subjectType,
    Long subjectId
) {
    public static AutomationExecutionDto from(AutomationExecution e) {
        return new AutomationExecutionDto(
            e.getId(),
            e.getAutomationRule().getId(),
            e.getAutomationRule().getName(),
            // Null pour les sujets non-reservation (facture, payout, device...).
            e.getReservation() != null ? e.getReservation().getId() : null,
            e.getStatus(),
            e.getErrorMessage(),
            e.getScheduledAt(),
            e.getExecutedAt(),
            e.getSubjectType(),
            e.getSubjectId()
        );
    }
}
