package com.clenzy.booking.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Demande de réservation (« devis ») soumise depuis le booking engine PUBLIC — parcours « Demande de
 * devis » (sans paiement immédiat). Org-scopée, créée en contexte public (orgId explicite, comme
 * {@code MarketingContact}). Le host est notifié (in-app) et répond hors ligne / par devis.
 */
@Entity
@Table(name = "booking_inquiries", indexes = {
    @Index(name = "idx_booking_inquiry_org", columnList = "organization_id")
})
public class BookingInquiry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Logement concerné (optionnel : le parcours peut ne pas avoir sélectionné de bien). */
    @Column(name = "property_id")
    private Long propertyId;

    @Column(name = "check_in")
    private LocalDate checkIn;

    @Column(name = "check_out")
    private LocalDate checkOut;

    @Column(name = "guests")
    private Integer guests;

    @Column(name = "name", length = 200)
    private String name;

    @Column(name = "email", nullable = false, length = 320)
    private String email;

    @Column(name = "phone", length = 40)
    private String phone;

    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    /** Statut de traitement : NEW (par défaut) → géré côté host. */
    @Column(name = "status", nullable = false, length = 20)
    private String status = "NEW";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public LocalDate getCheckIn() { return checkIn; }
    public void setCheckIn(LocalDate checkIn) { this.checkIn = checkIn; }

    public LocalDate getCheckOut() { return checkOut; }
    public void setCheckOut(LocalDate checkOut) { this.checkOut = checkOut; }

    public Integer getGuests() { return guests; }
    public void setGuests(Integer guests) { this.guests = guests; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
