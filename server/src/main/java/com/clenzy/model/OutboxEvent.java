package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Transactional Outbox Pattern : event persiste dans la meme transaction
 * que la mutation metier, puis relaye vers Kafka par le OutboxRelay.
 *
 * Garantit la coherence at-least-once entre la base de donnees
 * et le bus de messages (pas de perte d'event).
 *
 * PAS de @Filter("organizationFilter") : le relay doit traiter
 * tous les events de toutes les orgs.
 */
@Entity
@Table(name = "outbox_events")
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Type d'agregat source (ex: "CALENDAR", "RESERVATION", "PROPERTY") */
    @Column(name = "aggregate_type", nullable = false, length = 50)
    private String aggregateType;

    /** ID de l'agregat source (ex: propertyId, reservationId) */
    @Column(name = "aggregate_id", nullable = false, length = 100)
    private String aggregateId;

    /** Type d'event (ex: "CALENDAR_BOOKED", "CALENDAR_BLOCKED", "RESERVATION_CREATED") */
    @Column(name = "event_type", nullable = false, length = 100)
    private String eventType;

    /** Topic Kafka cible */
    @Column(name = "topic", nullable = false, length = 100)
    private String topic;

    /** Cle de partitionnement Kafka (ex: propertyId pour grouper par propriete) */
    @Column(name = "partition_key", length = 100)
    private String partitionKey;

    /** Payload JSON de l'event */
    @Column(name = "payload", nullable = false, columnDefinition = "JSONB")
    private String payload;

    /** Organization pour traçabilite (optionnel) */
    @Column(name = "organization_id")
    private Long organizationId;

    /** Statut de l'envoi : PENDING, SENT, FAILED */
    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";

    /** Nombre de tentatives d'envoi */
    @Column(name = "retry_count", nullable = false)
    private Integer retryCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    // Constructeurs

    public OutboxEvent() {}

    public OutboxEvent(String aggregateType, String aggregateId, String eventType,
                       String topic, String partitionKey, String payload, Long organizationId) {
        this.aggregateType = aggregateType;
        this.aggregateId = aggregateId;
        this.eventType = eventType;
        this.topic = topic;
        this.partitionKey = partitionKey;
        this.payload = payload;
        this.organizationId = organizationId;
        this.createdAt = LocalDateTime.now();
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getAggregateType() { return aggregateType; }
    public void setAggregateType(String aggregateType) { this.aggregateType = aggregateType; }

    public String getAggregateId() { return aggregateId; }
    public void setAggregateId(String aggregateId) { this.aggregateId = aggregateId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public String getPartitionKey() { return partitionKey; }
    public void setPartitionKey(String partitionKey) { this.partitionKey = partitionKey; }

    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getRetryCount() { return retryCount; }
    public void setRetryCount(Integer retryCount) { this.retryCount = retryCount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    @Override
    public String toString() {
        return "OutboxEvent{id=" + id + ", type=" + eventType + ", aggregate=" + aggregateType
                + ":" + aggregateId + ", status=" + status + "}";
    }
}
