package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Absence datee d'un prestataire — conges, arret, indisponibilite ponctuelle.
 *
 * <p>Les bornes sont INCLUSES : une absence « du 12 au 19 » couvre le 19
 * entier. C'est ainsi qu'on la saisit et qu'on la lit ; un intervalle
 * demi-ouvert obligerait a saisir le 20 pour ne pas travailler le 19.</p>
 */
@Entity
@Table(name = "team_absences")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class TeamAbsence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "reason", length = 200)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public TeamAbsence() {}

    public TeamAbsence(Long teamId, LocalDate startDate, LocalDate endDate, String reason) {
        this.teamId = teamId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.reason = reason;
    }

    /** La date tombe-t-elle dans l'absence (bornes incluses) ? */
    public boolean covers(LocalDate date) {
        return !date.isBefore(startDate) && !date.isAfter(endDate);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getTeamId() { return teamId; }
    public void setTeamId(Long teamId) { this.teamId = teamId; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
