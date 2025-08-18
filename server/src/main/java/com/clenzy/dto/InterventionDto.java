package com.clenzy.dto;

import com.clenzy.dto.validation.Create;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.InterventionType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.validation.constraints.NotNull;

public class InterventionDto {
    public Long id;

    @NotNull(groups = Create.class)
    public LocalDateTime startTime;

    public LocalDateTime endTime;
    public Double estimatedDurationHours;
    public Double actualDurationHours;
    public InterventionStatus status;
    public InterventionType type;
    public String notes;
    public String technicianNotes;
    public String customerFeedback;
    public Integer customerRating;
    public BigDecimal estimatedCost;
    public BigDecimal actualCost;
    public String materialsUsed;
    public String beforePhotosUrls;
    public String afterPhotosUrls;
    public boolean urgent;
    public boolean requiresFollowUp;
    public String followUpNotes;

    @NotNull(groups = Create.class)
    public Long serviceRequestId;

    @NotNull(groups = Create.class)
    public Long propertyId;

    public Long assignedTechnicianId;
    public Long teamId;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}


