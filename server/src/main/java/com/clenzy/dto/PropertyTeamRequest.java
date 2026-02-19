package com.clenzy.dto;

public class PropertyTeamRequest {

    private Long propertyId;
    private Long teamId;

    // Constructeurs
    public PropertyTeamRequest() {}

    public PropertyTeamRequest(Long propertyId, Long teamId) {
        this.propertyId = propertyId;
        this.teamId = teamId;
    }

    // Getters et Setters
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public Long getTeamId() { return teamId; }
    public void setTeamId(Long teamId) { this.teamId = teamId; }
}
