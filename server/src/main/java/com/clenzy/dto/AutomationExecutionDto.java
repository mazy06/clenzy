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
    LocalDateTime executedAt
) {
    public static AutomationExecutionDto from(AutomationExecution e) {
        return new AutomationExecutionDto(
            e.getId(),
            e.getAutomationRule().getId(),
            e.getAutomationRule().getName(),
            e.getReservation().getId(),
            e.getStatus(),
            e.getErrorMessage(),
            e.getScheduledAt(),
            e.getExecutedAt()
        );
    }
}
