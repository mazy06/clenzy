package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Execution d'un workflow guide par l'assistant IA.
 *
 * <p>Une instance = un parcours utilisateur d'une procedure declaree en YAML
 * dans {@code resources/workflows/}. L'agent enchaine les etapes en stockant
 * la reponse de l'user a chaque step dans {@link #collectedData} (JSON object
 * key = step.id).</p>
 *
 * <p>Multi-tenant via {@code organizationFilter} + ownership {@code keycloakId}.</p>
 */
@Entity
@Table(name = "assistant_workflow_run")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class AssistantWorkflowRun {

    public enum Status {
        ACTIVE,
        COMPLETED,
        ABANDONED;

        public static Status fromString(String raw) {
            if (raw == null || raw.isBlank()) return null;
            try {
                return Status.valueOf(raw.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "keycloak_id", nullable = false, length = 255)
    private String keycloakId;

    @Column(name = "conversation_id")
    private Long conversationId;

    @Column(name = "workflow_id", nullable = false, length = 120)
    private String workflowId;

    @Column(name = "current_step_idx", nullable = false)
    private int currentStepIdx = 0;

    /** JSON object : { stepId: collectedValue }. Stocke en TEXT/JSONB Postgres. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "collected_data", columnDefinition = "jsonb")
    private String collectedData;

    @Column(nullable = false, length = 20)
    private String status = Status.ACTIVE.name();

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt = LocalDateTime.now();

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /**
     * Optimistic locking (JPA {@code @Version}) : empeche le step-skip si deux
     * advanceWorkflow simultanes (frontend double-submit). Hibernate ajoute
     * {@code AND version = :expected} a l'UPDATE ; sur conflit, la seconde
     * transaction leve {@code OptimisticLockingFailureException}.
     */
    @jakarta.persistence.Version
    @Column(nullable = false)
    private Long version = 0L;

    public AssistantWorkflowRun() {}

    public AssistantWorkflowRun(Long organizationId, String keycloakId,
                                  Long conversationId, String workflowId) {
        this.organizationId = organizationId;
        this.keycloakId = keycloakId;
        this.conversationId = conversationId;
        this.workflowId = workflowId;
    }

    public Status getStatusEnum() {
        return Status.fromString(status);
    }

    public void setStatusEnum(Status s) {
        this.status = s.name();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getKeycloakId() { return keycloakId; }
    public void setKeycloakId(String keycloakId) { this.keycloakId = keycloakId; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public String getWorkflowId() { return workflowId; }
    public void setWorkflowId(String workflowId) { this.workflowId = workflowId; }
    public int getCurrentStepIdx() { return currentStepIdx; }
    public void setCurrentStepIdx(int currentStepIdx) { this.currentStepIdx = currentStepIdx; }
    public String getCollectedData() { return collectedData; }
    public void setCollectedData(String collectedData) { this.collectedData = collectedData; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
