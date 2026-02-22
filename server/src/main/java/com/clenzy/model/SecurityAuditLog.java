package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

/**
 * Entite pour les evenements de securite.
 * Separee de l'audit_log metier pour des raisons de retention,
 * requetes specifiques et acces restreint (SUPER_ADMIN uniquement).
 *
 * Exigence Airbnb Partner Niveau 7.
 */
@Entity
@Table(name = "security_audit_log", indexes = {
    @Index(name = "idx_sec_audit_event_type", columnList = "event_type"),
    @Index(name = "idx_sec_audit_created_at", columnList = "created_at"),
    @Index(name = "idx_sec_audit_actor", columnList = "actor_id, created_at DESC"),
    @Index(name = "idx_sec_audit_org", columnList = "organization_id, created_at DESC"),
    @Index(name = "idx_sec_audit_result_type", columnList = "result, event_type")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class SecurityAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private SecurityAuditEventType eventType;

    @Column(name = "actor_id", length = 255)
    private String actorId;

    @Column(name = "actor_email", length = 255)
    private String actorEmail;

    @Column(name = "actor_ip", length = 45)
    private String actorIp;

    @Column(name = "resource_type", length = 50)
    private String resourceType;

    @Column(name = "resource_id", length = 255)
    private String resourceId;

    @Column(length = 50)
    private String action;

    @Column(length = 20)
    private String result;

    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String details;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    // Constructeurs
    public SecurityAuditLog() {}

    public SecurityAuditLog(SecurityAuditEventType eventType, String action, String result) {
        this.eventType = eventType;
        this.action = action;
        this.result = result;
        this.createdAt = Instant.now();
    }

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public SecurityAuditEventType getEventType() { return eventType; }
    public void setEventType(SecurityAuditEventType eventType) { this.eventType = eventType; }

    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }

    public String getActorEmail() { return actorEmail; }
    public void setActorEmail(String actorEmail) { this.actorEmail = actorEmail; }

    public String getActorIp() { return actorIp; }
    public void setActorIp(String actorIp) { this.actorIp = actorIp; }

    public String getResourceType() { return resourceType; }
    public void setResourceType(String resourceType) { this.resourceType = resourceType; }

    public String getResourceId() { return resourceId; }
    public void setResourceId(String resourceId) { this.resourceId = resourceId; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
