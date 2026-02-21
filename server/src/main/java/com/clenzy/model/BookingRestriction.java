package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;

/**
 * Restriction de reservation pour une propriete sur une plage de dates.
 *
 * La restriction avec la priorite la plus haute s'applique en cas
 * de chevauchement. Si aucune restriction n'existe, pas de contrainte.
 *
 * Types de restrictions supportes :
 * - min_stay / max_stay : duree de sejour
 * - closed_to_arrival / closed_to_departure : jours fermes
 * - gap_days : buffer entre deux reservations
 * - advance_notice_days : preavis minimum
 * - days_of_week : restriction par jour de la semaine
 */
@Entity
@Table(name = "booking_restrictions")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class BookingRestriction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "min_stay")
    private Integer minStay;

    @Column(name = "max_stay")
    private Integer maxStay;

    @Column(name = "closed_to_arrival", nullable = false)
    private Boolean closedToArrival = false;

    @Column(name = "closed_to_departure", nullable = false)
    private Boolean closedToDeparture = false;

    @Column(name = "gap_days", nullable = false)
    private Integer gapDays = 0;

    @Column(name = "advance_notice_days")
    private Integer advanceNoticeDays;

    @Column(name = "days_of_week", columnDefinition = "INTEGER[]")
    private Integer[] daysOfWeek;

    @Column(nullable = false)
    private Integer priority = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs

    public BookingRestriction() {}

    public BookingRestriction(Property property, LocalDate startDate, LocalDate endDate,
                              Long organizationId) {
        this.property = property;
        this.startDate = startDate;
        this.endDate = endDate;
        this.organizationId = organizationId;
    }

    // Methodes metier

    /**
     * Verifie si cette restriction s'applique a une date de check-in donnee.
     * La date doit etre dans [startDate, endDate] et correspondre au jour de la semaine.
     */
    public boolean appliesTo(LocalDate checkInDate) {
        if (checkInDate.isBefore(startDate) || checkInDate.isAfter(endDate)) return false;
        if (daysOfWeek != null && daysOfWeek.length > 0) {
            int dayOfWeek = checkInDate.getDayOfWeek().getValue();
            return Arrays.asList(daysOfWeek).contains(dayOfWeek);
        }
        return true;
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public Integer getMinStay() { return minStay; }
    public void setMinStay(Integer minStay) { this.minStay = minStay; }

    public Integer getMaxStay() { return maxStay; }
    public void setMaxStay(Integer maxStay) { this.maxStay = maxStay; }

    public Boolean getClosedToArrival() { return closedToArrival; }
    public void setClosedToArrival(Boolean closedToArrival) { this.closedToArrival = closedToArrival; }

    public Boolean getClosedToDeparture() { return closedToDeparture; }
    public void setClosedToDeparture(Boolean closedToDeparture) { this.closedToDeparture = closedToDeparture; }

    public Integer getGapDays() { return gapDays; }
    public void setGapDays(Integer gapDays) { this.gapDays = gapDays; }

    public Integer getAdvanceNoticeDays() { return advanceNoticeDays; }
    public void setAdvanceNoticeDays(Integer advanceNoticeDays) { this.advanceNoticeDays = advanceNoticeDays; }

    public Integer[] getDaysOfWeek() { return daysOfWeek; }
    public void setDaysOfWeek(Integer[] daysOfWeek) { this.daysOfWeek = daysOfWeek; }

    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public String toString() {
        return "BookingRestriction{id=" + id + ", startDate=" + startDate + ", endDate=" + endDate
                + ", minStay=" + minStay + ", maxStay=" + maxStay + ", priority=" + priority + "}";
    }
}
