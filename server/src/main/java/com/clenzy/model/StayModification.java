package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Avenant de séjour (changement de dates) avec accord EXPLICITE du voyageur —
 * STAY_MODIFICATION v2 (vague M-D). Née PROPOSED (email + lien de confirmation),
 * exécutée à l'accord (CONFIRMED → chemin canonique
 * {@code ReservationService.reschedule} → DONE). Sert aussi d'audit.
 */
@Entity
@Table(name = "stay_modifications")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class StayModification {

    public enum Status { PROPOSED, CONFIRMED, DONE, CANCELLED }

    /** Validité de la proposition (heures). */
    public static final int EXPIRY_HOURS = 72;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @Column(name = "new_check_in", nullable = false)
    private LocalDate newCheckIn;

    @Column(name = "new_check_out", nullable = false)
    private LocalDate newCheckOut;

    @Column(name = "old_total", precision = 10, scale = 2)
    private BigDecimal oldTotal;

    @Column(name = "new_total", precision = 10, scale = 2)
    private BigDecimal newTotal;

    @Column(name = "price_delta", precision = 10, scale = 2)
    private BigDecimal priceDelta;

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
    public LocalDate getNewCheckIn() { return newCheckIn; }
    public void setNewCheckIn(LocalDate newCheckIn) { this.newCheckIn = newCheckIn; }
    public LocalDate getNewCheckOut() { return newCheckOut; }
    public void setNewCheckOut(LocalDate newCheckOut) { this.newCheckOut = newCheckOut; }
    public BigDecimal getOldTotal() { return oldTotal; }
    public void setOldTotal(BigDecimal oldTotal) { this.oldTotal = oldTotal; }
    public BigDecimal getNewTotal() { return newTotal; }
    public void setNewTotal(BigDecimal newTotal) { this.newTotal = newTotal; }
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
