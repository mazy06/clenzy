package com.clenzy.dto;

import java.util.List;

public class AssignmentRequest {
    private List<Long> clientIds;
    private List<Long> propertyIds;
    private String notes;
    
    // Constructeurs
    public AssignmentRequest() {}
    
    public AssignmentRequest(List<Long> clientIds, List<Long> propertyIds) {
        this.clientIds = clientIds;
        this.propertyIds = propertyIds;
    }
    
    // Getters et Setters
    public List<Long> getClientIds() {
        return clientIds;
    }
    
    public void setClientIds(List<Long> clientIds) {
        this.clientIds = clientIds;
    }
    
    public List<Long> getPropertyIds() {
        return propertyIds;
    }
    
    public void setPropertyIds(List<Long> propertyIds) {
        this.propertyIds = propertyIds;
    }
    
    public String getNotes() {
        return notes;
    }
    
    public void setNotes(String notes) {
        this.notes = notes;
    }
    
    @Override
    public String toString() {
        return "AssignmentRequest{" +
                "clientIds=" + clientIds +
                ", propertyIds=" + propertyIds +
                ", notes='" + notes + '\'' +
                '}';
    }
}
