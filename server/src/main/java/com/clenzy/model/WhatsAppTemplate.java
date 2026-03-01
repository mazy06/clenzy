package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "whatsapp_templates")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class WhatsAppTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "template_name", nullable = false)
    private String templateName;

    @Column(nullable = false, length = 10)
    private String language = "fr";

    @Column(length = 50)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WhatsAppTemplateStatus status = WhatsAppTemplateStatus.PENDING;

    @Column(columnDefinition = "JSONB")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private String components;

    @Column(name = "synced_at")
    private LocalDateTime syncedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getTemplateName() { return templateName; }
    public void setTemplateName(String templateName) { this.templateName = templateName; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public WhatsAppTemplateStatus getStatus() { return status; }
    public void setStatus(WhatsAppTemplateStatus status) { this.status = status; }
    public String getComponents() { return components; }
    public void setComponents(String components) { this.components = components; }
    public LocalDateTime getSyncedAt() { return syncedAt; }
    public void setSyncedAt(LocalDateTime syncedAt) { this.syncedAt = syncedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
