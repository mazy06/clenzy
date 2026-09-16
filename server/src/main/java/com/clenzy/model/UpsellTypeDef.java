package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Type de vente additionnelle — referentiel EXTENSIBLE.
 *
 * <h2>Ce qui a change</h2>
 * <p>C'etait un enum Java de neuf valeurs : chaque metier nouveau — un massage,
 * un forfait de ski, une carte SIM — imposait un deploiement pour exister. Les
 * soixante-neuf prestations du catalogue marquees vendables au voyageur etaient
 * donc inutilisables en upsell.</p>
 *
 * <h2>Portee</h2>
 * <p>{@code organizationId} vide = type de PLATEFORME, propose a tout le monde.
 * Renseigne = type propre a une organisation, qu'elle ajoute elle-meme. Meme
 * convention que {@code KbDocument}, ou NULL designe deja la documentation
 * globale.</p>
 *
 * <p>Nomme {@code ...Def} parce que le champ {@code type} d'une offre reste une
 * CHAINE : c'est le code qui fait foi, pas une association. Voir
 * {@link UpsellOffer#getType()}.</p>
 */
@Entity
@Table(name = "upsell_types")
public class UpsellTypeDef {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Vide pour un type de plateforme. Pas de filtre Hibernate : la lecture melange les deux portees. */
    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "code", nullable = false, length = 60)
    private String code;

    @Column(name = "label_fr", nullable = false, length = 120)
    private String labelFr;

    @Column(name = "label_en", nullable = false, length = 120)
    private String labelEn;

    @Column(name = "description", length = 300)
    private String description;

    @Column(name = "icon_key", length = 40)
    private String iconKey;

    /**
     * Prestation correspondante du catalogue place de marche, quand il y en a
     * une. Reference SOUPLE par code : c'est le pont entre ce qu'un
     * professionnel vend et ce qu'un hote propose.
     */
    @Column(name = "service_item_code", length = 60)
    private String serviceItemCode;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    /**
     * Types historiques references NOMMEMENT dans le code (l'agent de
     * supervision cherche {@code EARLY_CHECKIN} et {@code LATE_CHECKOUT}) :
     * ils ne doivent pas pouvoir etre supprimes depuis l'interface.
     */
    @Column(name = "system", nullable = false)
    private boolean system = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getLabelFr() { return labelFr; }
    public void setLabelFr(String labelFr) { this.labelFr = labelFr; }

    public String getLabelEn() { return labelEn; }
    public void setLabelEn(String labelEn) { this.labelEn = labelEn; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getIconKey() { return iconKey; }
    public void setIconKey(String iconKey) { this.iconKey = iconKey; }

    public String getServiceItemCode() { return serviceItemCode; }
    public void setServiceItemCode(String serviceItemCode) { this.serviceItemCode = serviceItemCode; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public boolean isSystem() { return system; }
    public void setSystem(boolean system) { this.system = system; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
