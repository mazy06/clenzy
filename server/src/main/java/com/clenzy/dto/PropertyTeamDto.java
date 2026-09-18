package com.clenzy.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

public class PropertyTeamDto {

    private Long id;
    private Long propertyId;
    private Long teamId;
    private String teamName;
    private String teamInterventionType;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime assignedAt;

    private String serviceItemCode;
    private int priority = 100;
    private boolean active = true;
    public String getServiceItemCode() { return serviceItemCode; }
    public void setServiceItemCode(String code) { serviceItemCode = code; }
    public int getPriority() { return priority; }
    public void setPriority(int value) { priority = value; }
    public boolean isActive() { return active; }
    public void setActive(boolean value) { active = value; }

    // Constructeurs
    public PropertyTeamDto() {}

    public PropertyTeamDto(Long id, Long propertyId, Long teamId, String teamName, String teamInterventionType, LocalDateTime assignedAt) {
        this.id = id;
        this.propertyId = propertyId;
        this.teamId = teamId;
        this.teamName = teamName;
        this.teamInterventionType = teamInterventionType;
        this.assignedAt = assignedAt;
    }

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public Long getTeamId() { return teamId; }
    public void setTeamId(Long teamId) { this.teamId = teamId; }

    public String getTeamName() { return teamName; }
    public void setTeamName(String teamName) { this.teamName = teamName; }

    public String getTeamInterventionType() { return teamInterventionType; }
    public void setTeamInterventionType(String teamInterventionType) { this.teamInterventionType = teamInterventionType; }

    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }
}
