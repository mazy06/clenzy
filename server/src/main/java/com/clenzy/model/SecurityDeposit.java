package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Caution / dépôt de garantie d'une réservation (Phase 4 différenciation).
 *
 * <p>Une caution par réservation ({@code uq (organization_id, reservation_id)} — idempotence et
 * garde-fou anti check-then-act, audit #8). Le {@code externalRef} porte la référence PSP
 * (PaymentIntent Stripe en pré-autorisation manuelle) du hold en cours ; il change à chaque
 * renouvellement du hold ({@link #holdExpiresAt}).</p>
 */
@Entity
@Table(name = "security_deposits",
    uniqueConstraints = @UniqueConstraint(name = "uq_security_deposit_org_reservation",
        columnNames = {"organization_id", "reservation_id"}))
public class SecurityDeposit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotNull
    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @NotNull
    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    /** Montant effectivement encaissé pour dommages (≤ amount), null tant que non capturé. */
    @Column(name = "captured_amount", precision = 12, scale = 2)
    private BigDecimal capturedAmount;

    @Size(max = 3)
    @Column(name = "currency", length = 3)
    private String currency;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private SecurityDepositStatus status = SecurityDepositStatus.PENDING;

    /** Référence PSP (Stripe PaymentIntent du hold en cours), null tant qu'aucun hold n'est posé. */
    @Size(max = 128)
    @Column(name = "external_ref", length = 128)
    private String externalRef;

    @Size(max = 512)
    @Column(name = "reason", length = 512)
    private String reason;

    /**
     * Fin de validité du hold en cours ({@code capture_before} Stripe) : au-delà, Stripe annule
     * l'autorisation et libère les fonds. Null tant qu'aucun hold n'est posé.
     */
    @Column(name = "hold_expires_at")
    private Instant holdExpiresAt;

    /** Dernier refus de pré-autorisation (code Stripe / decline_code), null si aucun. */
    @Size(max = 255)
    @Column(name = "hold_error", length = 255)
    private String holdError;

    /** Pré-autorisations refusées : dérive la clé d'idempotence d'une nouvelle tentative. */
    @Column(name = "hold_attempts", nullable = false)
    private int holdAttempts;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public SecurityDeposit() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public BigDecimal getCapturedAmount() { return capturedAmount; }
    public void setCapturedAmount(BigDecimal capturedAmount) { this.capturedAmount = capturedAmount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public SecurityDepositStatus getStatus() { return status; }
    public void setStatus(SecurityDepositStatus status) { this.status = status; }

    public String getExternalRef() { return externalRef; }
    public void setExternalRef(String externalRef) { this.externalRef = externalRef; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public Instant getHoldExpiresAt() { return holdExpiresAt; }
    public void setHoldExpiresAt(Instant holdExpiresAt) { this.holdExpiresAt = holdExpiresAt; }

    public String getHoldError() { return holdError; }
    public void setHoldError(String holdError) { this.holdError = holdError; }

    public int getHoldAttempts() { return holdAttempts; }
    public void setHoldAttempts(int holdAttempts) { this.holdAttempts = holdAttempts; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
