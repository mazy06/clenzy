package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Template de site hébergé réutilisable (galerie « Choisir un design » du Studio).
 *
 * <ul>
 *   <li>{@code organizationId} NULL → catalogue GLOBAL Clenzy : curé par le staff plateforme
 *       (SUPER_ADMIN / SUPER_MANAGER), visible en lecture par tous les orgs.</li>
 *   <li>{@code organizationId} renseigné → template PRIVÉ à l'organisation.</li>
 * </ul>
 *
 * Le design complet (thème + pages + customCss/Js) est sérialisé dans {@code contentJson} — un
 * {@code template.json} appliqué via le flux d'import existant. PAS de filtre tenant Hibernate ici :
 * les templates globaux (org NULL) doivent rester visibles cross-org (requête explicite dans le repo).
 */
@Entity
@Table(name = "site_templates", indexes = {
    @Index(name = "idx_site_templates_org", columnList = "organization_id")
})
public class SiteTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** NULL = catalogue global Clenzy ; sinon template privé à l'organisation. */
    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    /** product (défaut) | brand. */
    @Column(name = "register", length = 20)
    private String register = "product";

    @Column(name = "preview_url", length = 500)
    private String previewUrl;

    /** template.json complet (thème + pages + customCss/Js). */
    @Column(name = "content_json", nullable = false, columnDefinition = "text")
    private String contentJson;

    /** keycloakId du créateur (audit léger). */
    @Column(name = "created_by", length = 64)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getRegister() { return register; }
    public void setRegister(String register) { this.register = register; }

    public String getPreviewUrl() { return previewUrl; }
    public void setPreviewUrl(String previewUrl) { this.previewUrl = previewUrl; }

    public String getContentJson() { return contentJson; }
    public void setContentJson(String contentJson) { this.contentJson = contentJson; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
