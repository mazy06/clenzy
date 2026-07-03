package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Version d'un taux de conversion tokens → credits (campagne T-06, ADR-005).
 *
 * <p><b>Append-only</b> : un changement de taux = poser {@code effectiveTo} sur
 * la version courante + inserer la nouvelle. On n'UPDATE jamais les valeurs —
 * chaque ligne du ledger reference la version appliquee (audit/rejouabilite).</p>
 *
 * <p>Pas de type CACHED cote client : le debit applique le taux INPUT plein aux
 * tokens d'entree, statut cache ignore (ADR-006 — gain de cache garde en marge).
 * Le taux BYOK (ADR-008) est un facteur multiplicatif configure, pas des lignes
 * dupliquees.</p>
 */
@Entity
@Table(name = "ai_credit_rate_card")
public class AiCreditRateCard {

    public static final String TYPE_INPUT = "INPUT";
    public static final String TYPE_OUTPUT = "OUTPUT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String provider;

    /** Prefix-match du model id (le plus long gagne), convention LlmPricingService. */
    @Column(name = "model_prefix", nullable = false, length = 96)
    private String modelPrefix;

    @Column(name = "token_type", nullable = false, length = 16)
    private String tokenType;

    @Column(name = "provider_cost_micro_usd_per_1k", nullable = false)
    private int providerCostMicroUsdPer1k;

    @Column(name = "millicredits_per_1k", nullable = false)
    private int millicreditsPer1k;

    @Column(name = "effective_from", nullable = false)
    private Instant effectiveFrom;

    @Column(name = "effective_to")
    private Instant effectiveTo;

    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    protected AiCreditRateCard() {}

    public AiCreditRateCard(String provider, String modelPrefix, String tokenType,
                            int providerCostMicroUsdPer1k, int millicreditsPer1k,
                            String createdBy) {
        this.provider = provider;
        this.modelPrefix = modelPrefix;
        this.tokenType = tokenType;
        this.providerCostMicroUsdPer1k = providerCostMicroUsdPer1k;
        this.millicreditsPer1k = millicreditsPer1k;
        this.effectiveFrom = Instant.now();
        this.createdBy = createdBy;
    }

    public Long getId() { return id; }
    public String getProvider() { return provider; }
    public String getModelPrefix() { return modelPrefix; }
    public String getTokenType() { return tokenType; }
    public int getProviderCostMicroUsdPer1k() { return providerCostMicroUsdPer1k; }
    public int getMillicreditsPer1k() { return millicreditsPer1k; }
    public Instant getEffectiveFrom() { return effectiveFrom; }
    public Instant getEffectiveTo() { return effectiveTo; }
    public String getCreatedBy() { return createdBy; }
}
