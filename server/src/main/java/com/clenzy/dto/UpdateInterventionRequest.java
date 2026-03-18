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
    Long assignedToId
) {}
