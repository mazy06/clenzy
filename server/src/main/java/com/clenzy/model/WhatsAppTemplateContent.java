package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Contenu editable d'un template WhatsApp standard Clenzy.
 *
 * <p>Remplace les YAML hardcodes dans {@code resources/whatsapp-templates/*.yaml}
 * qui etaient charges au boot par {@link com.clenzy.service.messaging.whatsapp.WhatsAppTemplateLoader}.
 * Les hosts peuvent maintenant adapter le wording de chaque template depuis le
 * menu "Documents & Communication" > "Templates WhatsApp" du frontend.</p>
 *
 * <h3>Multi-tenant et fallback</h3>
 * <ul>
 *   <li>{@code organizationId = NULL} + {@code isSystem = true} : template systeme
 *       global Clenzy. Visible par toutes les orgs mais read-only.</li>
 *   <li>{@code organizationId} defini + {@code isSystem = false} : override per-org.
 *       Editable et supprimable (retour au defaut systeme).</li>
 * </ul>
 *
 * <p><b>Pas de {@code @Filter} Hibernate ici</b> : la resolution org/systeme se
 * fait explicitement dans
 * {@link com.clenzy.service.messaging.whatsapp.WhatsAppTemplateService#resolve}
 * (pas un filtre WHERE simple — il faut "fallback systeme si pas d'override org").
 * Mettre un filtre cacherait les templates systeme aux orgs, ce qui casserait
 * la resolution.</p>
 *
 * <h3>Format des variables</h3>
 * Le body est au format nomme : {@code "Bonjour {guestFirstName}, code {accessCode}"}.
 * La conversion vers le format positionnel Meta {@code "{{1}} {{2}}"} + la liste
 * ordonnee des parametres est faite a l'envoi par
 * {@code WhatsAppVariableConverter} (Phase 2).
 */
@Entity
@Table(name = "whatsapp_template_content")
public class WhatsAppTemplateContent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** NULL = template systeme global. Defini = override per-org. */
    @Column(name = "organization_id")
    private Long organizationId;

    /** Slug stable : "checkin_instructions", "arrival_code", ... */
    @Column(name = "template_key", nullable = false, length = 64)
    private String templateKey;

    /** Locale Meta : "fr_FR", "en_US", "ar_AR" (PAS ISO 639-1 brut). */
    @Column(name = "language", nullable = false, length = 8)
    private String language;

    /** Categorie Meta : UTILITY | MARKETING | AUTHENTICATION. */
    @Column(name = "category", nullable = false, length = 32)
    private String category;

    /** Body au format nomme : "Bonjour {guestFirstName} ...". Max 1024 chars (limite Meta). */
    @Column(name = "body_named", nullable = false, columnDefinition = "TEXT")
    private String bodyNamed;

    /** TRUE = template systeme Clenzy read-only. FALSE = override editable per-org. */
    @Column(name = "is_system", nullable = false)
    private boolean isSystem = false;

    /** Si override, pointe vers le template systeme parent (pour "Restaurer le defaut"). */
    @Column(name = "parent_template_id")
    private Long parentTemplateId;

    /** Nom Meta du template (sync apres submit MetaTemplateProvisioner). */
    @Column(name = "meta_template_name", length = 128)
    private String metaTemplateName;

    /** Statut Meta : PENDING | APPROVED | REJECTED | PAUSED | null (pas soumis). */
    @Column(name = "meta_approval_status", length = 32)
    private String metaApprovalStatus;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public WhatsAppTemplateContent() {}

    /**
     * Constructeur pour un OVERRIDE per-org (fork d'un template systeme).
     */
    public WhatsAppTemplateContent(Long organizationId, String templateKey, String language,
                                    String category, String bodyNamed, Long parentTemplateId) {
        this.organizationId = organizationId;
        this.templateKey = templateKey;
        this.language = language;
        this.category = category;
        this.bodyNamed = bodyNamed;
        this.parentTemplateId = parentTemplateId;
        this.isSystem = false;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getTemplateKey() { return templateKey; }
    public void setTemplateKey(String templateKey) { this.templateKey = templateKey; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getBodyNamed() { return bodyNamed; }
    public void setBodyNamed(String bodyNamed) { this.bodyNamed = bodyNamed; }
    public boolean isSystem() { return isSystem; }
    public void setSystem(boolean system) { isSystem = system; }
    public Long getParentTemplateId() { return parentTemplateId; }
    public void setParentTemplateId(Long parentTemplateId) { this.parentTemplateId = parentTemplateId; }
    public String getMetaTemplateName() { return metaTemplateName; }
    public void setMetaTemplateName(String metaTemplateName) { this.metaTemplateName = metaTemplateName; }
    public String getMetaApprovalStatus() { return metaApprovalStatus; }
    public void setMetaApprovalStatus(String metaApprovalStatus) { this.metaApprovalStatus = metaApprovalStatus; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
