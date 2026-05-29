package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Template email systeme editable depuis le menu "Documents & Communication".
 *
 * <p>Remplace les 5 String.format / StringBuilder hardcodes dans
 * {@code NoiseAlertNotificationService} et {@code EmailService} :</p>
 * <ul>
 *   <li>{@code noise_alert_owner} : alerte bruit au proprietaire</li>
 *   <li>{@code noise_alert_guest} : alerte bruit au voyageur</li>
 *   <li>{@code invitation_organization} : invitation a rejoindre une organisation</li>
 *   <li>{@code quote_request_internal} : notification interne demande de devis</li>
 *   <li>{@code maintenance_request_internal} : notification interne demande maintenance</li>
 * </ul>
 *
 * <h3>Modele de resolution</h3>
 * Identique a {@link WhatsAppTemplateContent} :
 * <ul>
 *   <li>{@code organizationId = NULL} + {@code isSystem = true} : template systeme global Baitly.</li>
 *   <li>{@code organizationId} defini + {@code isSystem = false} : override per-org editable.</li>
 *   <li>Resolution : override per-org > systeme (fallback).</li>
 * </ul>
 *
 * <h3>Variables speciales</h3>
 * En plus des variables nommees {@code {nameVar}} interpolees par
 * {@code TemplateInterpolationService}, certains templates utilisent des
 * variables speciales pre-rendues cote Java :
 * <ul>
 *   <li>{@code {detailsHtml}} : block HTML pour les listes dynamiques
 *       (services selectionnes, travaux, sections de tableaux). Pre-rendu par
 *       le service Java avant l'interpolation finale.</li>
 *   <li>{@code {urgencyBanner}} : banner colore (rouge/orange/bleu) selon
 *       urgency level pour maintenance_request_internal.</li>
 * </ul>
 * Ces variables apparaissent dans la sidebar UI comme "Variables systeme"
 * (non editables mais insertables).
 */
@Entity
@Table(name = "system_email_template")
public class SystemEmailTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** NULL = template systeme global. Defini = override per-org. */
    @Column(name = "organization_id")
    private Long organizationId;

    /** Slug stable : "noise_alert_owner", "invitation_organization", ... */
    @Column(name = "template_key", nullable = false, length = 64)
    private String templateKey;

    /** Locale ISO 639-1 : "fr", "en", "ar". Default "fr". */
    @Column(name = "language", nullable = false, length = 8)
    private String language = "fr";

    /** OWNER | GUEST | INTERNAL_TEAM | INVITED_USER (informationnel pour l'UI). */
    @Column(name = "recipient_type", nullable = false, length = 32)
    private String recipientType = "OWNER";

    /** Sujet de l'email (peut contenir des variables {nameVar}). Max 255 chars (limite SMTP). */
    @Column(name = "subject", nullable = false, length = 255)
    private String subject;

    /**
     * Body PLAIN TEXT edite par l'user. Variables {nameVar} interpolees au
     * runtime. Le wrapper HTML uniforme (header Baitly + footer) est applique
     * cote serveur via {@link com.clenzy.service.messaging.EmailWrapperService}
     * avant l'envoi — selon le {@link #wrapperStyle}.
     */
    @Column(name = "body", nullable = false, columnDefinition = "TEXT")
    private String body;

    /**
     * Determine le wrapper HTML applique cote serveur :
     * NOTIFICATION_OWNER | NOTIFICATION_GUEST | INVITATION | INTERNAL_FORM | INTERNAL_URGENT.
     */
    @Column(name = "wrapper_style", nullable = false, length = 32)
    private String wrapperStyle = "NOTIFICATION_OWNER";

    /** TRUE = systeme Baitly (read-only). FALSE = override editable per-org. */
    @Column(name = "is_system", nullable = false)
    private boolean isSystem = false;

    /** Si override, pointe vers le template systeme parent (pour "Restaurer le defaut"). */
    @Column(name = "parent_template_id")
    private Long parentTemplateId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public SystemEmailTemplate() {}

    /**
     * Constructeur pour un OVERRIDE per-org (fork d'un template systeme).
     */
    public SystemEmailTemplate(Long organizationId, String templateKey, String language,
                                 String recipientType, String subject, String body,
                                 String wrapperStyle, Long parentTemplateId) {
        this.organizationId = organizationId;
        this.templateKey = templateKey;
        this.language = language;
        this.recipientType = recipientType;
        this.subject = subject;
        this.body = body;
        this.wrapperStyle = wrapperStyle;
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
    public String getRecipientType() { return recipientType; }
    public void setRecipientType(String recipientType) { this.recipientType = recipientType; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getWrapperStyle() { return wrapperStyle; }
    public void setWrapperStyle(String wrapperStyle) { this.wrapperStyle = wrapperStyle; }
    public boolean isSystem() { return isSystem; }
    public void setSystem(boolean system) { isSystem = system; }
    public Long getParentTemplateId() { return parentTemplateId; }
    public void setParentTemplateId(Long parentTemplateId) { this.parentTemplateId = parentTemplateId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
