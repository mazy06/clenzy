package com.clenzy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "team_coverage_zones")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class TeamCoverageZone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    /** Code ISO 3166-1 alpha-2 ("FR", "MA", "SA"...). */
    @Column(name = "country", nullable = false, length = 2)
    private String country = "FR";

    /** France uniquement : code departement (ex "75"). Null pour les autres pays. */
    @Column(name = "department", length = 3)
    private String department;

    /** France uniquement : arrondissement (ex "75001"). Null pour les autres pays. */
    @Column(name = "arrondissement", length = 5)
    private String arrondissement;

    /** Hors France : libelle de la ville (ex "Marrakech"). Null pour la France. */
    @Column(name = "city", length = 100)
    private String city;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", insertable = false, updatable = false)
    private Team team;

    // Constructeurs
    public TeamCoverageZone() {
        this.createdAt = LocalDateTime.now();
    }

    public TeamCoverageZone(Long teamId, String department, String arrondissement) {
        this();
        this.teamId = teamId;
        this.country = "FR";
        this.department = department;
        this.arrondissement = arrondissement;
    }

    public TeamCoverageZone(Long teamId, String country, String department,
                            String arrondissement, String city) {
        this();
        this.teamId = teamId;
        this.country = country != null ? country : "FR";
        this.department = department;
        this.arrondissement = arrondissement;
        this.city = city;
    }

    // Getters et Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getTeamId() {
        return teamId;
    }

    public void setTeamId(Long teamId) {
        this.teamId = teamId;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getArrondissement() {
        return arrondissement;
    }

    public void setArrondissement(String arrondissement) {
        this.arrondissement = arrondissement;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Team getTeam() {
        return team;
    }

    public void setTeam(Team team) {
        this.team = team;
    }

    public Long getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(Long organizationId) {
        this.organizationId = organizationId;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }
}
