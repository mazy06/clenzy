package com.clenzy.dto;

public class ServiceRequestValidationRequest {
    public Long teamId;
    public Long userId;
    
    public ServiceRequestValidationRequest() {}
    
    public ServiceRequestValidationRequest(Long teamId, Long userId) {
        this.teamId = teamId;
        this.userId = userId;
    }
    
    public Long getTeamId() {
        return teamId;
    }
    
    public void setTeamId(Long teamId) {
        this.teamId = teamId;
    }
    
    public Long getUserId() {
        return userId;
    }
    
    public void setUserId(Long userId) {
        this.userId = userId;
    }
}
