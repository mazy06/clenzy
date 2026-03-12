package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Log d'utilisation de tokens par appel LLM.
 * Chaque appel provider.chat() genere un enregistrement.
 */
@Entity
@Table(name = "ai_token_usage", indexes = {
        @Index(name = "idx_ai_token_usage_org_feature_month", columnList = "organization_id, feature, month_year"),
        @Index(name = "idx_ai_token_usage_org_month", columnList = "organization_id, month_year")
})
public class AiTokenUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private AiFeature feature;

    @Column(nullable = false, length = 30)
    private String provider;

    @Column(length = 100)
    private String model;

    @Column(name = "prompt_tokens", nullable = false)
    private int promptTokens;

    @Column(name = "completion_tokens", nullable = false)
    private int completionTokens;

    @Column(name = "total_tokens", nullable = false)
    private int totalTokens;

    /** Format YYYY-MM, ex: "2026-03" */
    @Column(name = "month_year", nullable = false, length = 7)
    private String monthYear;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    // ─── Constructors ────────────────────────────────────────────────────

    public AiTokenUsage() {}

    public AiTokenUsage(Long organizationId, AiFeature feature, String provider,
                        String model, int promptTokens, int completionTokens,
                        int totalTokens, String monthYear) {
        this.organizationId = organizationId;
        this.feature = feature;
        this.provider = provider;
        this.model = model;
        this.promptTokens = promptTokens;
        this.completionTokens = completionTokens;
        this.totalTokens = totalTokens;
        this.monthYear = monthYear;
    }

    // ─── Getters / Setters ───────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public AiFeature getFeature() { return feature; }
    public void setFeature(AiFeature feature) { this.feature = feature; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public int getPromptTokens() { return promptTokens; }
    public void setPromptTokens(int promptTokens) { this.promptTokens = promptTokens; }

    public int getCompletionTokens() { return completionTokens; }
    public void setCompletionTokens(int completionTokens) { this.completionTokens = completionTokens; }

    public int getTotalTokens() { return totalTokens; }
    public void setTotalTokens(int totalTokens) { this.totalTokens = totalTokens; }

    public String getMonthYear() { return monthYear; }
    public void setMonthYear(String monthYear) { this.monthYear = monthYear; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
