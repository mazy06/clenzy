package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Poche de credits IA (campagne T-06b, ADR-005 / decisions D-101-D-102).
 *
 * <p>Ordre de consommation : SUBSCRIPTION d'abord (perissable en fin de cycle,
 * « ne pas gacher le mensuel »), puis TOPUP/PROMO par expiration croissante.
 * Pas de rollover : l'expiration est portee par {@link #expiresAt} ; le job
 * d'expiration (T-07) journalise le non-consomme en ligne EXPIRY du ledger.</p>
 */
@Entity
@Table(name = "ai_credit_grant")
public class AiCreditGrant {

    public static final String SOURCE_SUBSCRIPTION = "SUBSCRIPTION";
    public static final String SOURCE_TOPUP = "TOPUP";
    public static final String SOURCE_PROMO = "PROMO";
    /** Dotation initiale d'amorçage d'une org existante avant activation de l'enforcement (T-07). */
    public static final String SOURCE_INITIAL = "INITIAL";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(nullable = false, length = 16)
    private String source;

    @Column(name = "millicredits_granted", nullable = false)
    private long millicreditsGranted;

    @Column(name = "millicredits_consumed", nullable = false)
    private long millicreditsConsumed;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** Reference Stripe (invoice/checkout session) — idempotence des webhooks T-07. */
    @Column(name = "stripe_ref", length = 64, unique = true)
    private String stripeRef;

    protected AiCreditGrant() {}

    public AiCreditGrant(Long organizationId, String source, long millicreditsGranted,
                         Instant expiresAt, String stripeRef) {
        this.organizationId = organizationId;
        this.source = source;
        this.millicreditsGranted = millicreditsGranted;
        this.millicreditsConsumed = 0;
        this.grantedAt = Instant.now();
        this.expiresAt = expiresAt;
        this.stripeRef = stripeRef;
    }

    /** Millicredits restants dans la poche. */
    public long remaining() {
        return Math.max(0, millicreditsGranted - millicreditsConsumed);
    }

    /**
     * Consomme jusqu'a {@code amount} millicredits dans cette poche.
     *
     * @return le montant reellement applique (≤ amount, borne par le restant)
     */
    public long applyConsumption(long amount) {
        long applied = Math.min(amount, remaining());
        this.millicreditsConsumed += applied;
        return applied;
    }

    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public String getSource() { return source; }
    public long getMillicreditsGranted() { return millicreditsGranted; }
    public long getMillicreditsConsumed() { return millicreditsConsumed; }
    public Instant getGrantedAt() { return grantedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public String getStripeRef() { return stripeRef; }
}
