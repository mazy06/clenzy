package com.clenzy.dto;

public class PaymentSessionResponse {
    private String sessionId;
    private String url;
    private Long interventionId;
    
    public String getSessionId() {
        return sessionId;
    }
    
    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }
    
    public String getUrl() {
        return url;
    }
    
    public void setUrl(String url) {
        this.url = url;
    }
    
    public Long getInterventionId() {
        return interventionId;
    }
    
    public void setInterventionId(Long interventionId) {
        this.interventionId = interventionId;
    }
}
