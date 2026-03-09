package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "escrow_holds", indexes = {
    @Index(name = "idx_escrow_org", columnList = "organization_id"),
    @Index(name = "idx_escrow_reservation", columnList = "reservation_id"),
    @Index(name = "idx_escrow_status", columnList = "status")
})
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class EscrowHold {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "reservation_id")
    private Long reservationId;

    @Column(name = "transaction_id")
    private Long transactionId;

    @NotNull
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 3, nullable = false)
    private String currency = "EUR";

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EscrowStatus status = EscrowStatus.HELD;

    @Column(name = "held_at")
    private LocalDateTime heldAt;

    @Column(name = "release_at")
    private LocalDateTime releaseAt;

    @Column(name = "released_at")
    private LocalDateTime releasedAt;

    @Column(name = "release_trigger", length = 30)
    private String releaseTrigger;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (heldAt == null) heldAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }
    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long transactionId) { this.transactionId = transactionId; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public EscrowStatus getStatus() { return status; }
    public void setStatus(EscrowStatus status) { this.status = status; }
    public LocalDateTime getHeldAt() { return heldAt; }
    public void setHeldAt(LocalDateTime heldAt) { this.heldAt = heldAt; }
    public LocalDateTime getReleaseAt() { return releaseAt; }
    public void setReleaseAt(LocalDateTime releaseAt) { this.releaseAt = releaseAt; }
    public LocalDateTime getReleasedAt() { return releasedAt; }
    public void setReleasedAt(LocalDateTime releasedAt) { this.releasedAt = releasedAt; }
    public String getReleaseTrigger() { return releaseTrigger; }
    public void setReleaseTrigger(String releaseTrigger) { this.releaseTrigger = releaseTrigger; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
