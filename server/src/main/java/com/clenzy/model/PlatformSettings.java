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

    /** Verser les demandes de devis (landing) dans la waitlist tant que le PMS n'est pas public. */
    @Column(name = "add_devis_leads_to_waitlist", nullable = false)
    private boolean addDevisLeadsToWaitlist = true;

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

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
