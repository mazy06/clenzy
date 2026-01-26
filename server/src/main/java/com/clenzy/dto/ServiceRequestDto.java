package com.clenzy.dto;

import com.clenzy.dto.validation.Create;
import com.clenzy.model.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class ServiceRequestDto {
    public Long id;

    @NotBlank(groups = Create.class)
    @Size(min = 5, max = 100)
    public String title;

    public String description;

    @NotNull(groups = Create.class)
    public ServiceType serviceType;

    public Priority priority;
    public RequestStatus status;

    @NotNull(groups = Create.class)
    public LocalDateTime desiredDate;

    public String preferredTimeSlot;
    public Integer estimatedDurationHours;
    public BigDecimal estimatedCost;
    public BigDecimal actualCost;
    public String specialInstructions;
    public String accessNotes;
    public LocalDateTime guestCheckoutTime;
    public LocalDateTime guestCheckinTime;
    public boolean urgent;
    public boolean requiresApproval;
    public String approvedBy;
    public LocalDateTime approvedAt;

    @NotNull(groups = Create.class)
    public Long userId;

    @NotNull(groups = Create.class)
    public Long propertyId;

    // Objets complets pour éviter les "inconnu"
    public PropertyDto property;
    public UserDto user;
    
    // Assignation de la demande de service
    public Long assignedToId;
    public String assignedToType; // 'user' or 'team'
    public UserDto assignedToUser; // Si assigné à un utilisateur
    public TeamDto assignedToTeam; // Si assigné à une équipe

    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}


