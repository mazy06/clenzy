package com.clenzy.dto;

public class PropertyAssociationDto {
    private Long id;
    private String name;
    private String address;
    private String description;
    private Long ownerId;
    private String ownerName;
    private String assignedAt;
    private String notes;

    // Constructors
    public PropertyAssociationDto() {}

    public PropertyAssociationDto(Long id, String name, String address, String description,
                                 Long ownerId, String ownerName, String assignedAt, String notes) {
        this.id = id;
        this.name = name;
        this.address = address;
        this.description = description;
        this.ownerId = ownerId;
        this.ownerName = ownerName;
        this.assignedAt = assignedAt;
        this.notes = notes;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    
    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
    
    public String getAssignedAt() { return assignedAt; }
    public void setAssignedAt(String assignedAt) { this.assignedAt = assignedAt; }
    
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
