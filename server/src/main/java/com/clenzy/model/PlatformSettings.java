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

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
