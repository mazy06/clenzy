package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;

/**
 * Mapping per-org {@code (template_key, template_name, template_language)}.
 *
 * <p>Permet a une organisation de surcharger le template Meta utilise pour une
 * cle logique (ex: "briefing"). Si aucune ligne n'existe pour la cle, le
 * caller (BriefingDelivery) utilise un template par defaut applicatif.</p>
 *
 * <p>Multi-tenant via {@code organizationFilter}.</p>
 */
@Entity
@Table(name = "org_whatsapp_templates",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_org_wa_templates_org_key",
                columnNames = {"organization_id", "template_key"}))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class OrgWhatsAppTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Slug stable ("briefing", "reservation_reminder", "checkin_link", ...). */
    @Column(name = "template_key", nullable = false, length = 64)
    private String templateKey;

    /** Nom du template Meta-approuve cote Business Manager. */
    @Column(name = "template_name", nullable = false, length = 255)
    private String templateName;

    @Column(name = "template_language", nullable = false, length = 16)
    private String templateLanguage = "fr";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public OrgWhatsAppTemplate() {}

    public OrgWhatsAppTemplate(Long organizationId, String templateKey,
                                 String templateName, String templateLanguage) {
        this.organizationId = organizationId;
        this.templateKey = templateKey;
        this.templateName = templateName;
        this.templateLanguage = templateLanguage;
    }

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getTemplateKey() { return templateKey; }
    public void setTemplateKey(String templateKey) { this.templateKey = templateKey; }
    public String getTemplateName() { return templateName; }
    public void setTemplateName(String templateName) { this.templateName = templateName; }
    public String getTemplateLanguage() { return templateLanguage; }
    public void setTemplateLanguage(String templateLanguage) { this.templateLanguage = templateLanguage; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
