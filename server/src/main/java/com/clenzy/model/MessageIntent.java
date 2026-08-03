package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Intention détectée dans un message ENTRANT de voyageur — vague M-C des modèles
 * métier (M8). Classification LLM asynchrone et best-effort (un message sans
 * intent reste un message normal). Une ligne par message (dédup DB par
 * {@code message_id}) ; {@code extracted} porte les éléments structurés
 * (dates demandées, heure souhaitée…) pour les cartes de la constellation.
 */
@Entity
@Table(name = "message_intents")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class MessageIntent {

    public enum Intent {
        LATE_CHECKOUT_REQUEST,
        EARLY_CHECKIN_REQUEST,
        STAY_CHANGE_REQUEST,
        CANCELLATION_REQUEST,
        COMPLAINT,
        QUESTION,
        OTHER,
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "message_id", nullable = false, unique = true)
    private Long messageId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Intent intent = Intent.OTHER;

    @Column(nullable = false, precision = 4, scale = 3)
    private BigDecimal confidence = BigDecimal.ZERO;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String extracted;

    @Column(length = 80)
    private String model;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getMessageId() { return messageId; }
    public void setMessageId(Long messageId) { this.messageId = messageId; }
    public Intent getIntent() { return intent; }
    public void setIntent(Intent intent) { this.intent = intent; }
    public BigDecimal getConfidence() { return confidence; }
    public void setConfidence(BigDecimal confidence) { this.confidence = confidence; }
    public String getExtracted() { return extracted; }
    public void setExtracted(String extracted) { this.extracted = extracted; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
