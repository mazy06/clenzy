package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

/**
 * Etape d'un {@link AgentRun} (campagne T-05, ADR-002) : appel LLM, execution
 * d'outil, delegation a un specialist, pause HITL, synthese finale.
 *
 * <p>Le champ {@link #detail} est un resume court (≤512) — JAMAIS les arguments
 * d'outils (PII) : ceux-ci restent dans l'audit masque
 * ({@code AgentActionAuditService}).</p>
 */
@Entity
@Table(name = "agent_step",
        uniqueConstraints = @UniqueConstraint(name = "uq_agent_step_run_seq",
                columnNames = {"run_id", "step_seq"}))
public class AgentStep {

    public static final String KIND_LLM_CALL = "LLM_CALL";
    public static final String KIND_TOOL_CALL = "TOOL_CALL";
    public static final String KIND_DELEGATION = "DELEGATION";
    public static final String KIND_PAUSE = "PAUSE";
    public static final String KIND_SUMMARY = "SUMMARY";

    public static final String STATUS_SUCCESS = "SUCCESS";
    public static final String STATUS_ERROR = "ERROR";

    static final int MAX_DETAIL_LENGTH = 512;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "run_id", nullable = false)
    private UUID runId;

    @Column(name = "step_seq", nullable = false)
    private int stepSeq;

    @Column(nullable = false, length = 24)
    private String kind;

    /** mono | multi_agent | orchestrator | specialist:<nom> | router | hitl */
    @Column(nullable = false, length = 64)
    private String agent;

    @Column(name = "tool_name", length = 96)
    private String toolName;

    @Column(length = MAX_DETAIL_LENGTH)
    private String detail;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(length = 96)
    private String model;

    @Column(name = "prompt_tokens", nullable = false)
    private int promptTokens;

    @Column(name = "completion_tokens", nullable = false)
    private int completionTokens;

    @Column(name = "cached_prompt_tokens", nullable = false)
    private int cachedPromptTokens;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AgentStep() {}

    public AgentStep(UUID runId, int stepSeq, String kind, String agent, String toolName,
                     String detail, String status, String model,
                     int promptTokens, int completionTokens, int cachedPromptTokens) {
        this.runId = runId;
        this.stepSeq = stepSeq;
        this.kind = kind;
        this.agent = agent;
        this.toolName = toolName;
        this.detail = truncate(detail);
        this.status = status;
        this.model = model;
        this.promptTokens = promptTokens;
        this.completionTokens = completionTokens;
        this.cachedPromptTokens = cachedPromptTokens;
        this.createdAt = Instant.now();
    }

    private static String truncate(String s) {
        if (s == null || s.length() <= MAX_DETAIL_LENGTH) return s;
        return s.substring(0, MAX_DETAIL_LENGTH - 1) + "…";
    }

    public Long getId() { return id; }
    public UUID getRunId() { return runId; }
    public int getStepSeq() { return stepSeq; }
    public String getKind() { return kind; }
    public String getAgent() { return agent; }
    public String getToolName() { return toolName; }
    public String getDetail() { return detail; }
    public String getStatus() { return status; }
    public String getModel() { return model; }
    public int getPromptTokens() { return promptTokens; }
    public int getCompletionTokens() { return completionTokens; }
    public int getCachedPromptTokens() { return cachedPromptTokens; }
    public Instant getCreatedAt() { return createdAt; }
}
