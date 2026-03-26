package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Devis ou facture de blanchisserie pour une propriete.
 * Les lignes ({@code lines}) sont un snapshot JSON des prix au moment de la generation.
 */
@Entity
@Table(name = "laundry_quotes")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class LaundryQuote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "reservation_id")
    private Long reservationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LaundryQuoteStatus status = LaundryQuoteStatus.DRAFT;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String lines;

    @Column(name = "total_ht", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalHt = BigDecimal.ZERO;

    @Column(nullable = false, length = 3)
    private String currency = "EUR";

    @CreationTimestamp
    @Column(name = "generated_at", nullable = false, updatable = false)
    private LocalDateTime generatedAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(columnDefinition = "TEXT")
    private String notes;

    public LaundryQuote() {}

    // ── Getters / Setters ────────────────────────────────────────────────

    public Long getId() { return id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public LaundryQuoteStatus getStatus() { return status; }
    public void setStatus(LaundryQuoteStatus status) { this.status = status; }

    public String getLines() { return lines; }
    public void setLines(String lines) { this.lines = lines; }

    public BigDecimal getTotalHt() { return totalHt; }
    public void setTotalHt(BigDecimal totalHt) { this.totalHt = totalHt; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public LocalDateTime getGeneratedAt() { return generatedAt; }

    public LocalDateTime getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(LocalDateTime confirmedAt) { this.confirmedAt = confirmedAt; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
