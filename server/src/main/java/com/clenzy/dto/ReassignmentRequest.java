package com.clenzy.dto;

public class ReassignmentRequest {
    private Long newManagerId;
    private String notes;

    // Constructeurs
    public ReassignmentRequest() {}

    public ReassignmentRequest(Long newManagerId, String notes) {
        this.newManagerId = newManagerId;
        this.notes = notes;
    }

    // Getters et Setters
    public Long getNewManagerId() {
        return newManagerId;
    }

    public void setNewManagerId(Long newManagerId) {
        this.newManagerId = newManagerId;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    @Override
    public String toString() {
        return "ReassignmentRequest{" +
               "newManagerId=" + newManagerId +
               ", notes='" + notes + '\'' +
               '}';
    }
}
