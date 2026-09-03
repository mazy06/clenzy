package com.clenzy.dto;

public class UserAssociationDto {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String role;
    private String assignedAt;
    private String notes;

    /** Ville de rattachement de l'intervenant : axe de regroupement. */
    private String city;

    /**
     * Villes que l'intervenant declare couvrir, portees par son equipe
     * personnelle. Distinctes de {@link #city} : un responsable de secteur
     * siege dans une ville et intervient dans plusieurs.
     */
    private java.util.List<String> coverageCities = new java.util.ArrayList<>();

    /** URL ticketee de la photo de profil, ou null. */
    private String avatarUrl;
    private Long portfolioId;
    private String portfolioName;

    // Constructors
    public UserAssociationDto() {}

    public UserAssociationDto(Long id, String firstName, String lastName, String email,
                             String role, String assignedAt, String notes,
                             Long portfolioId, String portfolioName) {
        this.id = id;
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.role = role;
        this.assignedAt = assignedAt;
        this.notes = notes;
        this.portfolioId = portfolioId;
        this.portfolioName = portfolioName;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    
    public String getAssignedAt() { return assignedAt; }
    public void setAssignedAt(String assignedAt) { this.assignedAt = assignedAt; }
    
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    
    public Long getPortfolioId() { return portfolioId; }
    public void setPortfolioId(Long portfolioId) { this.portfolioId = portfolioId; }
    
    public String getPortfolioName() { return portfolioName; }
    public void setPortfolioName(String portfolioName) { this.portfolioName = portfolioName; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public java.util.List<String> getCoverageCities() { return coverageCities; }
    public void setCoverageCities(java.util.List<String> coverageCities) {
        this.coverageCities = coverageCities;
    }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
}
