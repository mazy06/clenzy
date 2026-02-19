package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Table d'audit pour tracer toutes les actions sensibles.
 * Exigence Airbnb Partner : audit trail avec retention minimum 2 ans.
 */
@Entity
@Table(name = "audit_log", indexes = {
    @Index(name = "idx_audit_log_timestamp", columnList = "timestamp"),
    @Index(name = "idx_audit_log_user_id", columnList = "userId"),
    @Index(name = "idx_audit_log_entity", columnList = "entityType, entityId")
})
@org.hibernate.annotations.FilterDef(
    name = "organizationFilter",
    parameters = @org.hibernate.annotations.ParamDef(name = "orgId", type = Long.class)
)
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(nullable = false)
    private Instant timestamp = Instant.now();

    @Column(length = 255)
    private String userId;

    @Column(length = 255)
    private String userEmail;

    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private AuditAction action;

    @Column(nullable = false, length = 100)
    private String entityType;

    @Column(length = 255)
    private String entityId;

    @Column(columnDefinition = "TEXT")
    private String oldValue;

    @Column(columnDefinition = "TEXT")
    private String newValue;

    @Column(length = 45)
    private String ipAddress;

    @Column(columnDefinition = "TEXT")
    private String userAgent;

    @Column(length = 50)
    @Enumerated(EnumType.STRING)
    private AuditSource source = AuditSource.WEB;

    @Column(columnDefinition = "TEXT")
    private String details;

    // Constructeurs
    public AuditLog() {}

    public AuditLog(AuditAction action, String entityType, String entityId) {
        this.timestamp = Instant.now();
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
    }

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public AuditAction getAction() { return action; }
    public void setAction(AuditAction action) { this.action = action; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }

    public String getOldValue() { return oldValue; }
    public void setOldValue(String oldValue) { this.oldValue = oldValue; }

    public String getNewValue() { return newValue; }
    public void setNewValue(String newValue) { this.newValue = newValue; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public AuditSource getSource() { return source; }
    public void setSource(AuditSource source) { this.source = source; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }
}
