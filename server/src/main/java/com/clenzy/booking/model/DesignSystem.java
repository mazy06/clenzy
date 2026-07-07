package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Système de design réutilisable (direction de design Baitly, inspiré du modèle open-design).
 *
 * <p>Un système capture la DIRECTION d'un design : le contrat de tokens {@code --bt-*} ({@code tokensJson})
 * <b>et</b> un {@code DESIGN.md} en prose ({@code designMarkdown} : atmosphère, palette & rôles, typo,
 * layout, composants, motion, iconographie, <b>voix & ton</b>, edge cases). C'est cette prose qui rend les
 * générations distinctives et on-brand — au-delà des seuls tokens.</p>
 *
 * <ul>
 *   <li>{@code organizationId} NULL → catalogue GLOBAL (staff plateforme), visible de tous les orgs.</li>
 *   <li>{@code organizationId} renseigné → système PRIVÉ à l'organisation.</li>
 * </ul>
 *
 * Réutilisable et attachable à un {@link SiteTemplate} (association {@code designSystemId}, phase DS-3).
 */
@Entity
@Table(name = "design_systems", indexes = {
    @Index(name = "idx_design_systems_org", columnList = "organization_id")
})
public class DesignSystem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** NULL = catalogue global Baitly ; sinon système privé à l'organisation. */
    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "category", length = 60)
    private String category;

    @Column(name = "description", length = 500)
    private String description;

    /** DRAFT (staff seulement) | PUBLISHED (visible des users org). */
    @Column(name = "status", length = 20, nullable = false)
    private String status = "PUBLISHED";

    /** Map JSON des tokens {@code --bt-*} (contrat de tokens unifié). */
    @Column(name = "tokens_json", columnDefinition = "text")
    private String tokensJson;

    /** Le {@code DESIGN.md} en prose (direction de design). */
    @Column(name = "design_markdown", columnDefinition = "text")
    private String designMarkdown;

    /** Origine : MANUAL | BRAND | PASTE | URL. */
    @Column(name = "source_type", length = 20)
    private String sourceType;

    /** Référence de la source (URL analysée, le cas échéant). */
    @Column(name = "source_ref", length = 1000)
    private String sourceRef;

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

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getTokensJson() { return tokensJson; }
    public void setTokensJson(String tokensJson) { this.tokensJson = tokensJson; }

    public String getDesignMarkdown() { return designMarkdown; }
    public void setDesignMarkdown(String designMarkdown) { this.designMarkdown = designMarkdown; }

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }

    public String getSourceRef() { return sourceRef; }
    public void setSourceRef(String sourceRef) { this.sourceRef = sourceRef; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
