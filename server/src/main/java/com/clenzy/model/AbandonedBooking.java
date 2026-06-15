package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Panier abandonné (CLZ Domaine 2 — récupération de panier) : snapshot d'une réservation PENDING
 * expirée (non payée), avec l'email du voyageur, pour déclencher un email de relance unique.
 * Org-scopé, dédupliqué par (org, reservation).
 */
@Entity
@Table(name = "abandoned_bookings",
        uniqueConstraints = @UniqueConstraint(name = "uq_abandoned_bookings_org_reservation",
                columnNames = {"organization_id", "reservation_id"}))
public class AbandonedBooking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @Column(name = "property_id")
    private Long propertyId;

    @Column(name = "property_name", length = 255)
    private String propertyName;

    @Column(name = "guest_email", nullable = false, length = 320)
    private String guestEmail;

    @Column(name = "guest_name", length = 200)
    private String guestName;

    @Column(name = "check_in")
    private LocalDate checkIn;

    @Column(name = "check_out")
    private LocalDate checkOut;

    @Column(name = "guests")
    private Integer guests;

    @Column(name = "total", precision = 12, scale = 2)
    private BigDecimal total;

    @Column(name = "currency", length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private AbandonedBookingStatus status = AbandonedBookingStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "recovery_sent_at")
    private Instant recoverySentAt;

    /** Nombre de relances déjà envoyées (multi-étapes 2.12 : 1h / 24h / 72h). */
    @Column(name = "reminder_count", nullable = false)
    private int reminderCount = 0;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }
    public String getGuestEmail() { return guestEmail; }
    public void setGuestEmail(String guestEmail) { this.guestEmail = guestEmail; }
    public String getGuestName() { return guestName; }
    public void setGuestName(String guestName) { this.guestName = guestName; }
    public LocalDate getCheckIn() { return checkIn; }
    public void setCheckIn(LocalDate checkIn) { this.checkIn = checkIn; }
    public LocalDate getCheckOut() { return checkOut; }
    public void setCheckOut(LocalDate checkOut) { this.checkOut = checkOut; }
    public Integer getGuests() { return guests; }
    public void setGuests(Integer guests) { this.guests = guests; }
    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public AbandonedBookingStatus getStatus() { return status; }
    public void setStatus(AbandonedBookingStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getRecoverySentAt() { return recoverySentAt; }
    public void setRecoverySentAt(Instant recoverySentAt) { this.recoverySentAt = recoverySentAt; }
    public int getReminderCount() { return reminderCount; }
    public void setReminderCount(int reminderCount) { this.reminderCount = reminderCount; }
}
