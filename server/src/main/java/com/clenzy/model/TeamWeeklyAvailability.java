package com.clenzy.model;

import jakarta.persistence.*;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.LocalDateTime;

/**
 * Creneau hebdomadaire recurrent d'un prestataire — equipe classique ou equipe
 * PERSONNELLE d'un intervenant independant.
 *
 * <p>Regle qui gouverne tout le reste : <b>aucune ligne = disponible</b>. Un
 * prestataire qui n'a rien declare reste eligible, comme avant l'existence de
 * cette table. Traiter l'absence de declaration comme une indisponibilite
 * aurait sorti d'un coup toutes les equipes existantes du moteur.</p>
 */
@Entity
@Table(name = "team_weekly_availability")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class TeamWeeklyAvailability {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    /** ISO-8601 : 1 = lundi … 7 = dimanche, comme {@link DayOfWeek#getValue()}. */
    @Column(name = "day_of_week", nullable = false)
    private Short dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public TeamWeeklyAvailability() {}

    public TeamWeeklyAvailability(Long teamId, Short dayOfWeek, LocalTime startTime, LocalTime endTime) {
        this.teamId = teamId;
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    /** Le creneau couvre-t-il entierement [from, to] ce jour-la ? */
    public boolean covers(DayOfWeek day, LocalTime from, LocalTime to) {
        return dayOfWeek != null
                && dayOfWeek == day.getValue()
                && !from.isBefore(startTime)
                && !to.isAfter(endTime);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getTeamId() { return teamId; }
    public void setTeamId(Long teamId) { this.teamId = teamId; }

    public Short getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(Short dayOfWeek) { this.dayOfWeek = dayOfWeek; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
