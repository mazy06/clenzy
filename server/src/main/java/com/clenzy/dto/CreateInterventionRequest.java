package com.clenzy.dto;

import jakarta.validation.constraints.*;

public record CreateInterventionRequest(
    @NotBlank @Size(min = 5, max = 100) String title,
    @Size(max = 500) String description,
    @NotBlank String type,
    @NotBlank String priority,
    @NotNull Long propertyId,
    @NotNull Long requestorId,
    @NotBlank String scheduledDate,
    @Min(1) Integer estimatedDurationHours,
    String assignedToType,
    Long assignedToId
) {}
