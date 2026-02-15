package com.clenzy.dto;

import com.clenzy.dto.validation.Create;
import com.clenzy.dto.validation.Update;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Min;

public class InterventionDto {
    public Long id;

    @NotBlank(groups = Create.class)
    @Size(min = 5, max = 100, groups = {Create.class, Update.class})
    public String title;

    @Size(max = 500, groups = {Create.class, Update.class})
    public String description;

    @NotBlank(groups = Create.class)
    public String type;

    @NotBlank(groups = Create.class)
    public String status;

    @NotBlank(groups = Create.class)
    public String priority;

    @NotNull(groups = Create.class)
    public Long propertyId;

    @NotNull(groups = Create.class)
    public Long requestorId;

    public Long assignedToId;
    public String assignedToType; // 'user' or 'team'
    public String assignedToName;

    @NotBlank(groups = Create.class)
    public String scheduledDate; // String pour la compatibilité avec le frontend

    @Min(value = 1, groups = {Create.class, Update.class})
    public Integer estimatedDurationHours;

    public Integer actualDurationMinutes;
    public BigDecimal estimatedCost;
    public BigDecimal actualCost;
    public String notes;
    public String photos;
    public Integer progressPercentage;

    // Champs de lecture (non modifiables)
    public String propertyName;
    public String propertyAddress;
    public String requestorName;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public LocalDateTime completedAt;
    
    // Champs de paiement
    public String paymentStatus;
    public String stripePaymentIntentId;
    public String stripeSessionId;
    public LocalDateTime paidAt;
}
