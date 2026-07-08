package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Réglages plateforme Baitly — singleton (une seule ligne, id = 1).
 *
 * Non scopé par organisation : ce sont des toggles globaux de la plateforme,
 * gérés par les SUPER_ADMIN / SUPER_MANAGER. Pas de @Filter tenant ici.
 */
@Entity
@Table(name = "platform_settings")
public class PlatformSettings {

    public static final Long SINGLETON_ID = 1L;

    @Id
    private Long id = SINGLETON_ID;

    /** Envoi des emails de devis aux prospects (landing). Désactivable en pré-lancement. */
    @Column(name = "send_prospect_devis_emails", nullable = false)
    private boolean sendProspectDevisEmails = true;

    /** Verser les demandes de devis (landing) dans la waitlist. Desactive par defaut :
     *  seules les inscriptions via le formulaire /bientot-disponible alimentent la waitlist. */
    @Column(name = "add_devis_leads_to_waitlist", nullable = false)
    private boolean addDevisLeadsToWaitlist = false;

    /**
     * Destinataires des notifications internes equipe (lead devis, copie devis,
     * waitlist, maintenance), au format CSV. L'expediteur reste TOUJOURS
     * info@clenzy.fr ; seul le(s) destinataire(s) est/sont configurable(s) ici
     * pour eviter le self-send info@->info@ qui soft-bounce.
     */
    @Column(name = "internal_notification_emails", nullable = false, columnDefinition = "TEXT")
    private String internalNotificationEmails = "info@clenzy.fr";

    /**
     * Adresse d'expedition (From) de la plateforme. Niveau plateforme (pas
     * multi-tenant). Defaut info@clenzy.fr. Changer de domaine impose d'authentifier
     * ce domaine dans Brevo (SPF/DKIM) sous peine de spam/bounce.
     */
    @Column(name = "sender_email", nullable = false, columnDefinition = "TEXT")
    private String senderEmail = "info@clenzy.fr";

    /** Nom d'affichage du From ({@code Baitly <info@clenzy.fr>}). */
    @Column(name = "sender_name", nullable = false, columnDefinition = "TEXT")
    private String senderName = "Baitly";

    /**
     * Bibliothèque GLOBALE de widgets composites du booking engine (JSON, même format que
     * {@code booking_engine_configs.composite_widgets}). Niveau plateforme : alimentée par les
     * SUPER_ADMIN / SUPER_MANAGER, elle est visible (lecture) dans le Studio de TOUS les booking
     * engines, en plus des composites propres à chaque engine. {@code null}/absent = aucune.
     */
    @Column(name = "global_composite_widgets", columnDefinition = "TEXT")
    private String globalCompositeWidgets;

    /**
     * Master plateforme du concierge IA — brouillon de réponse sur message guest entrant.
     * OFF par défaut : ouvre la capacité à tous les orgs (chacun opte ensuite via son
     * module « Communication ». Piloté en base pour éviter un redéploiement.
     */
    @Column(name = "concierge_draft_enabled", nullable = false)
    private boolean conciergeDraftEnabled = false;

    /**
     * Master plateforme de l'auto-envoi concierge. OFF par défaut. Même activé, un org
     * n'auto-envoie que si son autonomie « Communication » ≠ SUGGÈRE et que son palier
     * atteint {@link #conciergeAutosendMinForfait}.
     */
    @Column(name = "concierge_autosend_enabled", nullable = false)
    private boolean conciergeAutosendEnabled = false;

    /** Palier (forfait) minimal requis pour l'auto-envoi concierge — défaut « premium ». */
    @Column(name = "concierge_autosend_min_forfait", nullable = false, columnDefinition = "TEXT")
    private String conciergeAutosendMinForfait = "premium";

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "updated_by")
    private String updatedBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public boolean isSendProspectDevisEmails() { return sendProspectDevisEmails; }
    public void setSendProspectDevisEmails(boolean sendProspectDevisEmails) { this.sendProspectDevisEmails = sendProspectDevisEmails; }

    public boolean isAddDevisLeadsToWaitlist() { return addDevisLeadsToWaitlist; }
    public void setAddDevisLeadsToWaitlist(boolean addDevisLeadsToWaitlist) { this.addDevisLeadsToWaitlist = addDevisLeadsToWaitlist; }

    public String getInternalNotificationEmails() { return internalNotificationEmails; }
    public void setInternalNotificationEmails(String internalNotificationEmails) { this.internalNotificationEmails = internalNotificationEmails; }

    public String getSenderEmail() { return senderEmail; }
    public void setSenderEmail(String senderEmail) { this.senderEmail = senderEmail; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getGlobalCompositeWidgets() { return globalCompositeWidgets; }
    public void setGlobalCompositeWidgets(String globalCompositeWidgets) { this.globalCompositeWidgets = globalCompositeWidgets; }

    public boolean isConciergeDraftEnabled() { return conciergeDraftEnabled; }
    public void setConciergeDraftEnabled(boolean conciergeDraftEnabled) { this.conciergeDraftEnabled = conciergeDraftEnabled; }

    public boolean isConciergeAutosendEnabled() { return conciergeAutosendEnabled; }
    public void setConciergeAutosendEnabled(boolean conciergeAutosendEnabled) { this.conciergeAutosendEnabled = conciergeAutosendEnabled; }

    public String getConciergeAutosendMinForfait() { return conciergeAutosendMinForfait; }
    public void setConciergeAutosendMinForfait(String conciergeAutosendMinForfait) { this.conciergeAutosendMinForfait = conciergeAutosendMinForfait; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
