package com.clenzy.dto;

public class TeamAssociationDto {
    private Long id;
    private String name;
    private String description;
    private Integer memberCount;
    private String assignedAt;
    private String notes;

    /**
     * Ville couverte par l'equipe, prise sur sa zone d'intervention. NULL quand
     * la zone n'est definie qu'au departement.
     */
    private String city;

    /** CLEANING | MAINTENANCE — le metier, qui transitait dans {@code notes}. */
    private String interventionType;

    /** Les membres, nommes. Un compte seul ne dit pas qui travaille ou. */
    private java.util.List<TeamMemberSummaryDto> members = new java.util.ArrayList<>();

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

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getInterventionType() { return interventionType; }
    public void setInterventionType(String interventionType) { this.interventionType = interventionType; }

    public java.util.List<TeamMemberSummaryDto> getMembers() { return members; }
    public void setMembers(java.util.List<TeamMemberSummaryDto> members) { this.members = members; }
}
