package com.clenzy.dto;

import jakarta.validation.constraints.*;

public record CreateInterventionRequest(
    @NotBlank @Size(min = 5, max = 100) String title,
    @Size(max = 500) String description,
    @NotBlank String type,
    @NotBlank String priority,
    Long propertyId,
    @NotNull Long requestorId,
    @NotBlank String scheduledDate,
    @Min(1) Integer estimatedDurationHours,
    String assignedToType,
    Long assignedToId,
    @Size(max = 60) String serviceItemCode
) {
    public CreateInterventionRequest(String title, String description, String type, String priority,
            Long propertyId, Long requestorId, String scheduledDate, Integer estimatedDurationHours,
            String assignedToType, Long assignedToId) {
        this(title, description, type, priority, propertyId, requestorId, scheduledDate,
                estimatedDurationHours, assignedToType, assignedToId, null);
    }
}
