package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import java.math.BigDecimal;
import java.time.Instant;

/** Journal Baitly des transferts vers les bénéficiaires. TRANSFERRED ne signifie pas crédit bancaire. */
@Entity
@Table(name = "payout_transfers")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PayoutTransfer {
    public enum Source { OWNER_PAYOUT, INTERVENTION, PROVIDER_EXPENSE, COMMERCE }
    public enum State { SUBMITTING, TRANSFERRED, RECONCILIATION_REQUIRED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "organization_id", nullable = false, updatable = false) private Long organizationId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false, length = 30) private Source source;
    @Column(name = "source_id", nullable = false, updatable = false) private Long sourceId;
    @Column(name = "beneficiary_user_id", updatable = false) private Long beneficiaryUserId;
    @Column(name = "beneficiary_organization_id", updatable = false) private Long beneficiaryOrganizationId;
    @Column(nullable = false, updatable = false, precision = 12, scale = 2) private BigDecimal amount;
    @Column(nullable = false, updatable = false, length = 3) private String currency;
    @Column(nullable = false, updatable = false, length = 30) private String provider;
    @Column(nullable = false, updatable = false, length = 100) private String destination;
    @Column(nullable = false, updatable = false, length = 255) private String description;
    @Column(name = "idempotency_key", nullable = false, updatable = false, length = 100) private String idempotencyKey;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private State state;
    @Column(name = "external_reference", length = 255) private String externalReference;
    @Column(name = "destination_payment", length = 255) private String destinationPayment;
    @Column(name = "stripe_livemode") private Boolean stripeLivemode;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public Source getSource() { return source; }
    public Long getSourceId() { return sourceId; }
    public Long getBeneficiaryUserId() { return beneficiaryUserId; }
    public Long getBeneficiaryOrganizationId() { return beneficiaryOrganizationId; }
    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
    public String getProvider() { return provider; }
    public String getDestination() { return destination; }
    public String getDescription() { return description; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public State getState() { return state; }
    public String getExternalReference() { return externalReference; }
    public String getDestinationPayment() { return destinationPayment; }
    public Boolean getStripeLivemode() { return stripeLivemode; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void transferred(String reference) {
        if (reference == null || reference.isBlank()) throw new IllegalArgumentException("Référence de transfert absente.");
        if (externalReference != null && !externalReference.equals(reference)) {
            throw new IllegalStateException("Une autre référence est déjà associée à ce transfert.");
        }
        externalReference = reference;
        state = State.TRANSFERRED;
        updatedAt = Instant.now();
    }

    public void captureDestinationPayment(String payment, Boolean livemode) {
        if (payment == null && livemode == null) return; // Historique sans preuve bancaire.
        if (payment == null || payment.isBlank() || livemode == null) throw new IllegalArgumentException("Preuve Stripe incomplète.");
        if (destinationPayment != null && (!destinationPayment.equals(payment) || !stripeLivemode.equals(livemode))) {
            throw new IllegalStateException("La preuve Stripe d'origine ne peut pas changer.");
        }
        destinationPayment = payment;
        stripeLivemode = livemode;
    }

    public void requireReconciliation() {
        if (state == State.TRANSFERRED) return;
        state = State.RECONCILIATION_REQUIRED;
        updatedAt = Instant.now();
    }
}
