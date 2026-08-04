package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Proposition de relogement d'un séjour — vague M-D des modèles métier (M11 v2).
 * Jamais un déménagement d'office : la ligne naît PROPOSED (email + lien de
 * confirmation au voyageur), le transfert ne s'exécute qu'à son accord explicite
 * (CONFIRMED → chemin canonique {@code ReservationService.relodge} → DONE).
 * Le voyageur peut refuser (CANCELLED). Sert aussi d'historique/audit.
 */
@Entity
@Table(name = "stay_transfers")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class StayTransfer {

    public enum Status { PROPOSED, CONFIRMED, DONE, CANCELLED }

    /** Validité de la proposition (heures) — au-delà, le lien est périmé. */
    public static final int EXPIRY_HOURS = 72;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @Column(name = "from_property_id", nullable = false)
    private Long fromPropertyId;

    @Column(name = "to_property_id", nullable = false)
    private Long toPropertyId;

    @Column(columnDefinition = "TEXT")
    private String reason;

    /** 0 en v2 : même tarif, geste commercial géré séparément. */
    @Column(name = "price_delta", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceDelta = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PROPOSED;

    @Column(name = "confirm_token", nullable = false, unique = true)
    private UUID confirmToken;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "proposed_by", length = 120)
    private String proposedBy;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "executed_at")
    private Instant executedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }
    public Long getFromPropertyId() { return fromPropertyId; }
    public void setFromPropertyId(Long fromPropertyId) { this.fromPropertyId = fromPropertyId; }
    public Long getToPropertyId() { return toPropertyId; }
    public void setToPropertyId(Long toPropertyId) { this.toPropertyId = toPropertyId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public BigDecimal getPriceDelta() { return priceDelta; }
    public void setPriceDelta(BigDecimal priceDelta) { this.priceDelta = priceDelta; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public UUID getConfirmToken() { return confirmToken; }
    public void setConfirmToken(UUID confirmToken) { this.confirmToken = confirmToken; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public String getProposedBy() { return proposedBy; }
    public void setProposedBy(String proposedBy) { this.proposedBy = proposedBy; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(Instant confirmedAt) { this.confirmedAt = confirmedAt; }
    public Instant getExecutedAt() { return executedAt; }
    public void setExecutedAt(Instant executedAt) { this.executedAt = executedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
