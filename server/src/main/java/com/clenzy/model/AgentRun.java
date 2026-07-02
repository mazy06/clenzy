package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Run d'agent persiste (campagne T-05, ADR-002) : une execution de l'assistant
 * (tour de chat, reprise HITL...) tracee pour le replay Constellation et,
 * a terme, le ledger de credits (T-06).
 *
 * <p>Ecrit en async best-effort par {@code AgentRunRecorder} — l'absence d'une
 * ligne ne doit jamais etre interpretee comme l'absence d'un run.</p>
 *
 * <p>Pas de {@code @Filter} tenant Hibernate : la lecture passe exclusivement
 * par {@code AgentRunQueryService} qui valide l'organisation explicitement
 * (pattern requireSameOrganization).</p>
 */
@Entity
@Table(name = "agent_run")
public class AgentRun {

    public static final String STATUS_RUNNING = "RUNNING";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_PAUSED = "PAUSED";
    public static final String STATUS_ERROR = "ERROR";

    /** Assigne cote applicatif (UUID du run, connu avant l'insert → utilisable en SSE). */
    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "keycloak_user_id", length = 64)
    private String keycloakUserId;

    @Column(name = "conversation_id")
    private Long conversationId;

    /** chat | chat_resume | supervision | briefing | batch... */
    @Column(nullable = false, length = 32)
    private String origin;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String error;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    protected AgentRun() {}

    public AgentRun(UUID id, Long organizationId, String keycloakUserId,
                    Long conversationId, String origin) {
        this.id = id;
        this.organizationId = organizationId;
        this.keycloakUserId = keycloakUserId;
        this.conversationId = conversationId;
        this.origin = origin;
        this.status = STATUS_RUNNING;
        this.startedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public String getKeycloakUserId() { return keycloakUserId; }
    public Long getConversationId() { return conversationId; }
    public String getOrigin() { return origin; }
    public String getStatus() { return status; }
    public String getError() { return error; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getFinishedAt() { return finishedAt; }

    public void finish(String status, String error) {
        this.status = status;
        this.error = error;
        this.finishedAt = Instant.now();
    }
}
