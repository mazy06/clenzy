package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Journal d'envoi des briefings — garantit l'idempotence via la contrainte
 * unique {@code (keycloak_id, briefing_date)}. Si le scheduler est invoque
 * deux fois le meme jour (restart, race), le 2e insert leve une violation
 * de contrainte et on sait que le briefing a deja ete envoye.
 */
@Entity
@Table(name = "assistant_briefing_log",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_assistant_briefing_log_user_date",
                columnNames = {"keycloak_id", "briefing_date"}))
public class AssistantBriefingLog {

    public enum Status {
        SENT,
        FAILED,
        SKIPPED,
        /**
         * Etat transitoire : un BriefingRetryScheduler a acquis ce log et est
         * en train de re-tenter le dispatch. Permet d'eviter qu'une autre
         * instance acquiere le meme log en parallele (compare-and-swap).
         * Apres dispatch : SENT (succes) ou FAILED (echec persistant).
         */
        RETRYING
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "keycloak_id", nullable = false, length = 255)
    private String keycloakId;

    @Column(name = "briefing_date", nullable = false)
    private LocalDate briefingDate;

    @Column(nullable = false, length = 30)
    private String frequency;

    @Column(name = "conversation_id")
    private Long conversationId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "channels", columnDefinition = "jsonb")
    private String channels;

    @Column(nullable = false, length = 20)
    private String status = Status.SENT.name();

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt = LocalDateTime.now();

    public AssistantBriefingLog() {}

    public AssistantBriefingLog(Long organizationId, String keycloakId,
                                  LocalDate briefingDate, String frequency) {
        this.organizationId = organizationId;
        this.keycloakId = keycloakId;
        this.briefingDate = briefingDate;
        this.frequency = frequency;
    }

    public void setStatusEnum(Status s) { this.status = s.name(); }
    public Status getStatusEnum() {
        try { return Status.valueOf(status); }
        catch (Exception e) { return Status.FAILED; }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getKeycloakId() { return keycloakId; }
    public void setKeycloakId(String keycloakId) { this.keycloakId = keycloakId; }
    public LocalDate getBriefingDate() { return briefingDate; }
    public void setBriefingDate(LocalDate briefingDate) { this.briefingDate = briefingDate; }
    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public String getChannels() { return channels; }
    public void setChannels(String channels) { this.channels = channels; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }
}
