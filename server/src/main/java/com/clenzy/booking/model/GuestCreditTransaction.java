package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Écriture du ledger de crédit fidélité (2.8 phase 2b) : montant signé en centimes (gain positif,
 * rédemption/clawback négatif). {@code reservationCode} rattache l'écriture à une réservation ;
 * un index unique partiel (organization_id, reservation_code, type) garantit l'idempotence du gain.
 */
@Entity
@Table(name = "guest_credit_transactions",
    indexes = @Index(name = "idx_guest_credit_tx_account", columnList = "account_id"))
public class GuestCreditTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "amount_cents", nullable = false)
    private long amountCents;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private GuestCreditTxType type;

    @Column(name = "reservation_code", length = 100)
    private String reservationCode;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAccountId() { return accountId; }
    public void setAccountId(Long accountId) { this.accountId = accountId; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public long getAmountCents() { return amountCents; }
    public void setAmountCents(long amountCents) { this.amountCents = amountCents; }

    public GuestCreditTxType getType() { return type; }
    public void setType(GuestCreditTxType type) { this.type = type; }

    public String getReservationCode() { return reservationCode; }
    public void setReservationCode(String reservationCode) { this.reservationCode = reservationCode; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
