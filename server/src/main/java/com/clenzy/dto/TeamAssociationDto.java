package com.clenzy.dto;

public class TeamAssociationDto {
    private Long id;
    private String name;
    private String description;
    private Integer memberCount;
    private String assignedAt;
    private String notes;

    // Constructors
    public TeamAssociationDto() {}

    public TeamAssociationDto(Long id, String name, String description, Integer memberCount,
                             String assignedAt, String notes) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.memberCount = memberCount;
        this.assignedAt = assignedAt;
        this.notes = notes;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public Integer getMemberCount() { return memberCount; }
    public void setMemberCount(Integer memberCount) { this.memberCount = memberCount; }
    
    public String getAssignedAt() { return assignedAt; }
    public void setAssignedAt(String assignedAt) { this.assignedAt = assignedAt; }
    
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
