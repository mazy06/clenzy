package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Represente un jour dans le calendrier d'une propriete.
 * Chaque ligne = 1 propriete x 1 date.
 *
 * Source de verite pour :
 * - La disponibilite (status)
 * - Le prix par nuit (nightly_price)
 * - Le sejour minimum (min_stay)
 * - Le lien avec une reservation (reservation_id)
 *
 * Les mutations passent par CalendarEngine qui serialise
 * les ecritures via pg_advisory_xact_lock(property_id).
 */
@Entity
@Table(name = "calendar_days",
       uniqueConstraints = @UniqueConstraint(columnNames = {"property_id", "date"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class CalendarDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CalendarDayStatus status = CalendarDayStatus.AVAILABLE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id")
    private Reservation reservation;

    @Column(name = "nightly_price", precision = 10, scale = 2)
    private BigDecimal nightlyPrice;

    @Column(name = "min_stay")
    private Integer minStay = 1;

    @Column(name = "max_stay")
    private Integer maxStay;

    /** Jour de changement : le checkout et le check-in peuvent se faire le meme jour */
    @Column(name = "changeover_day")
    private Boolean changeoverDay = true;

    @Column(name = "source", length = 30)
    private String source = "MANUAL";

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs

    public CalendarDay() {}

    public CalendarDay(Property property, LocalDate date, CalendarDayStatus status, Long organizationId) {
        this.property = property;
        this.date = date;
        this.status = status;
        this.organizationId = organizationId;
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public CalendarDayStatus getStatus() { return status; }
    public void setStatus(CalendarDayStatus status) { this.status = status; }

    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation reservation) { this.reservation = reservation; }

    public BigDecimal getNightlyPrice() { return nightlyPrice; }
    public void setNightlyPrice(BigDecimal nightlyPrice) { this.nightlyPrice = nightlyPrice; }

    public Integer getMinStay() { return minStay; }
    public void setMinStay(Integer minStay) { this.minStay = minStay; }

    public Integer getMaxStay() { return maxStay; }
    public void setMaxStay(Integer maxStay) { this.maxStay = maxStay; }

    public Boolean getChangeoverDay() { return changeoverDay; }
    public void setChangeoverDay(Boolean changeoverDay) { this.changeoverDay = changeoverDay; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    @Override
    public String toString() {
        return "CalendarDay{id=" + id + ", propertyId=" + (property != null ? property.getId() : null)
                + ", date=" + date + ", status=" + status + "}";
    }
}
