package com.clenzy.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record UpdateInterventionRequest(
    @Size(min = 5, max = 100) String title,
    @Size(max = 500) String description,
    String type,
    String priority,
    @Min(1) Integer estimatedDurationHours,
    BigDecimal estimatedCost,
    String notes,
    String assignedToType,
    Long assignedToId,
    @Size(max = 60) String serviceItemCode
) {
    public UpdateInterventionRequest(String title, String description, String type, String priority,
            Integer estimatedDurationHours, BigDecimal estimatedCost, String notes,
            String assignedToType, Long assignedToId) {
        this(title, description, type, priority, estimatedDurationHours, estimatedCost, notes,
                assignedToType, assignedToId, null);
    }
}
