package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "teams")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class Team {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, length = 50)
    private String interventionType;

    @OneToMany(mappedBy = "team", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<TeamMember> members = new ArrayList<>();

    @OneToMany(mappedBy = "team", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<TeamCoverageZone> coverageZones = new ArrayList<>();

    /**
     * Intervenant represente par cette equipe d'une seule personne, ou
     * {@code null} pour une equipe classique.
     *
     * <p>Le moteur d'affectation ne raisonne qu'en equipes : zones clefees par
     * team_id, occupation testee par team_id, metier porte par
     * {@code interventionType}. Une equipe personnelle rend un independant
     * visible de ce moteur sans le dupliquer pour les personnes.</p>
     */
    @Column(name = "personal_user_id")
    private Long personalUserId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Constructeurs
    public Team() {
        this.createdAt = LocalDateTime.now();
    }

    public Team(String name, String description, String interventionType) {
        this();
        this.name = name;
        this.description = description;
        this.interventionType = interventionType;
    }

    // Getters et Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getInterventionType() {
        return interventionType;
    }

    public void setInterventionType(String interventionType) {
        this.interventionType = interventionType;
    }

    public List<TeamMember> getMembers() {
        return members;
    }

    public void setMembers(List<TeamMember> members) {
        this.members = members;
    }

    public Long getPersonalUserId() {
        return personalUserId;
    }

    public void setPersonalUserId(Long personalUserId) {
        this.personalUserId = personalUserId;
    }

    /** Equipe d'une seule personne, creee pour un intervenant independant. */
    public boolean isPersonal() {
        return personalUserId != null;
    }

    public List<TeamCoverageZone> getCoverageZones() {
        return coverageZones;
    }

    public void setCoverageZones(List<TeamCoverageZone> coverageZones) {
        this.coverageZones = coverageZones;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    // Méthodes utilitaires
    public int getMemberCount() {
        return members != null ? members.size() : 0;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}


