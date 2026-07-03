package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Pause HITL persistee (campagne X1, ADR-002) : journal durable des actions en
 * attente de confirmation, avec leur resolution.
 *
 * <p>Triple role : reprise post-reboot du flux mono ({@link #payloadHistoryJson}),
 * affichage « en attente » resilient (fallback Redis), et donnee d'apprentissage
 * des Regles de Confiance (X2) : la suite CONFIRMED/REFUSED/EXPIRED par
 * (org, outil) est la matiere premiere de l'autonomie apprise.</p>
 */
@Entity
@Table(name = "agent_pending_action")
public class AgentPendingAction {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_CONFIRMED = "CONFIRMED";
    public static final String STATUS_REFUSED = "REFUSED";
    public static final String STATUS_EXPIRED = "EXPIRED";

    @Id
    @Column(name = "tool_call_id", length = 96)
    private String toolCallId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "keycloak_user_id", nullable = false, length = 64)
    private String keycloakUserId;

    @Column(name = "conversation_id")
    private Long conversationId;

    @Column(name = "tool_name", nullable = false, length = 96)
    private String toolName;

    /** Arguments complets — necessaires a l'execution en cas de reprise post-reboot. */
    @Column(name = "args_json", columnDefinition = "TEXT")
    private String argsJson;

    @Column(length = 512)
    private String description;

    @Column(length = 64)
    private String specialist;

    @Column(name = "multi_agent", nullable = false)
    private boolean multiAgent;

    /** Historique de reprise mono (JSON, attachments strippes) ; NULL pour le multi. */
    @Column(name = "payload_history_json", columnDefinition = "TEXT")
    private String payloadHistoryJson;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    protected AgentPendingAction() {}

    public AgentPendingAction(String toolCallId, Long organizationId, String keycloakUserId,
                              Long conversationId, String toolName, String argsJson,
                              String description, String specialist, boolean multiAgent,
                              String payloadHistoryJson, Instant expiresAt) {
        this.toolCallId = toolCallId;
        this.organizationId = organizationId;
        this.keycloakUserId = keycloakUserId;
        this.conversationId = conversationId;
        this.toolName = toolName;
        this.argsJson = argsJson;
        this.description = description;
        this.specialist = specialist;
        this.multiAgent = multiAgent;
        this.payloadHistoryJson = payloadHistoryJson;
        this.status = STATUS_PENDING;
        this.createdAt = Instant.now();
        this.expiresAt = expiresAt;
    }

    public void resolve(String status) {
        this.status = status;
        this.resolvedAt = Instant.now();
    }

    public String getToolCallId() { return toolCallId; }
    public Long getOrganizationId() { return organizationId; }
    public String getKeycloakUserId() { return keycloakUserId; }
    public Long getConversationId() { return conversationId; }
    public String getToolName() { return toolName; }
    public String getArgsJson() { return argsJson; }
    public String getDescription() { return description; }
    public String getSpecialist() { return specialist; }
    public boolean isMultiAgent() { return multiAgent; }
    public String getPayloadHistoryJson() { return payloadHistoryJson; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getResolvedAt() { return resolvedAt; }
}
