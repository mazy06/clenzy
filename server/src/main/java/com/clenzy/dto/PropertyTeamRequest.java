package com.clenzy.dto;

public class PropertyTeamRequest {

    private Long propertyId;
    private Long teamId;

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
