package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Ligne du ledger d'usage IA (campagne T-06, ADR-005) — APPEND-ONLY, source de
 * verite temps reel : jamais d'UPDATE/DELETE, une correction = ligne
 * ADJUSTMENT compensatoire.
 *
 * <p>Porte a la fois le debit client ({@link #millicredits}, negatif) et le
 * cout provider reel ({@link #providerCostMicroUsd}, cache deduit) : la marge
 * du caching se mesure ligne a ligne sans affecter le client (ADR-006).</p>
 *
 * <p>{@link #idempotencyKey} unique en DB : un retry de metering ne produit
 * jamais un double debit (l'insert en double est rejete et ignore).</p>
 */
@Entity
@Table(name = "ai_usage_ledger")
public class AiUsageLedgerEntry {

    public static final String TYPE_DEBIT = "DEBIT";
    public static final String TYPE_GRANT = "GRANT";
    public static final String TYPE_EXPIRY = "EXPIRY";
    public static final String TYPE_ADJUSTMENT = "ADJUSTMENT";
    public static final String TYPE_REFUND = "REFUND";

    public static final String BUCKET_INTERACTIVE = "INTERACTIVE";
    public static final String BUCKET_SOCLE = "SOCLE";
    public static final String BUCKET_PREMIUM_AUTO = "PREMIUM_AUTO";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "keycloak_user_id", length = 64)
    private String keycloakUserId;

    @Column(name = "run_id")
    private UUID runId;

    @Column(name = "step_seq")
    private Integer stepSeq;

    @Column(nullable = false, length = 64)
    private String agent;

    @Column(nullable = false, length = 32)
    private String feature;

    @Column(name = "entry_type", nullable = false, length = 16)
    private String entryType;

    @Column(name = "autonomy_bucket", nullable = false, length = 16)
    private String autonomyBucket;

    @Column(length = 32)
    private String provider;

    @Column(length = 96)
    private String model;

    @Column(name = "prompt_tokens", nullable = false)
    private int promptTokens;

    @Column(name = "completion_tokens", nullable = false)
    private int completionTokens;

    @Column(name = "cached_prompt_tokens", nullable = false)
    private int cachedPromptTokens;

    @Column(name = "input_rate_card_id")
    private Long inputRateCardId;

    @Column(name = "output_rate_card_id")
    private Long outputRateCardId;

    /** Negatif = debit client, en millicredits (1 credit = 1000). */
    @Column(nullable = false)
    private long millicredits;

    @Column(name = "provider_cost_micro_usd", nullable = false)
    private long providerCostMicroUsd;

    @Column(name = "idempotency_key", nullable = false, length = 128, unique = true)
    private String idempotencyKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AiUsageLedgerEntry() {}

    public AiUsageLedgerEntry(Long organizationId, String keycloakUserId, UUID runId,
                              Integer stepSeq, String agent, String feature,
                              String entryType, String autonomyBucket,
                              String provider, String model,
                              int promptTokens, int completionTokens, int cachedPromptTokens,
                              Long inputRateCardId, Long outputRateCardId,
                              long millicredits, long providerCostMicroUsd,
                              String idempotencyKey) {
        this.organizationId = organizationId;
        this.keycloakUserId = keycloakUserId;
        this.runId = runId;
        this.stepSeq = stepSeq;
        this.agent = agent;
        this.feature = feature;
        this.entryType = entryType;
        this.autonomyBucket = autonomyBucket;
        this.provider = provider;
        this.model = model;
        this.promptTokens = promptTokens;
        this.completionTokens = completionTokens;
        this.cachedPromptTokens = cachedPromptTokens;
        this.inputRateCardId = inputRateCardId;
        this.outputRateCardId = outputRateCardId;
        this.millicredits = millicredits;
        this.providerCostMicroUsd = providerCostMicroUsd;
        this.idempotencyKey = idempotencyKey;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public String getKeycloakUserId() { return keycloakUserId; }
    public UUID getRunId() { return runId; }
    public Integer getStepSeq() { return stepSeq; }
    public String getAgent() { return agent; }
    public String getFeature() { return feature; }
    public String getEntryType() { return entryType; }
    public String getAutonomyBucket() { return autonomyBucket; }
    public String getProvider() { return provider; }
    public String getModel() { return model; }
    public int getPromptTokens() { return promptTokens; }
    public int getCompletionTokens() { return completionTokens; }
    public int getCachedPromptTokens() { return cachedPromptTokens; }
    public Long getInputRateCardId() { return inputRateCardId; }
    public Long getOutputRateCardId() { return outputRateCardId; }
    public long getMillicredits() { return millicredits; }
    public long getProviderCostMicroUsd() { return providerCostMicroUsd; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public Instant getCreatedAt() { return createdAt; }
}
