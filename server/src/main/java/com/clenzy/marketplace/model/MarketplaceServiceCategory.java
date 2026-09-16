package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Categorie de service de la place de marche (menage, chauffeur, guide...).
 *
 * <p><b>En base et non en enum Java</b> : la liste des metiers est ouverte par
 * nature. Un enum aurait impose un deploiement pour chaque metier ajoute, alors
 * que le referentiel doit rester administrable.</p>
 *
 * <p>A ne pas confondre avec {@code ServiceType} / {@code InterventionType},
 * qui decrivent les interventions PLANIFIEES dans le PMS et restent inchanges :
 * ici on decrit ce qu'un professionnel VEND, la-bas ce que l'exploitation
 * EXECUTE.</p>
 */
@Entity
@Table(name = "marketplace_service_categories")
public class MarketplaceServiceCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, length = 40)
    private String code;

    @Column(name = "label_fr", nullable = false, length = 80)
    private String labelFr;

    @Column(name = "label_en", nullable = false, length = 80)
    private String labelEn;

    @Column(name = "description", length = 300)
    private String description;

    /**
     * Famille du metier. Groupe les pastilles de filtre : trente-deux sur une
     * ligne ne se lisent plus, groupees elles se parcourent.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "family", nullable = false, length = 20)
    private CategoryFamily family = CategoryFamily.OPERATIONS;

    /** Clef d'icone resolue cote interface — jamais un chemin de fichier. */
    @Column(name = "icon_key", length = 40)
    private String iconKey;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    /**
     * Metier USUEL de la location courte duree.
     *
     * <p>Reste visible en tete du filtre meme sans prestataire : « personne ne
     * couvre la serrurerie » est exactement ce qu'un gestionnaire doit voir, et
     * le classement par volume seul l'aurait enfoui sous un repli.</p>
     */
    @Column(name = "common", nullable = false)
    private boolean common = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getLabelFr() { return labelFr; }
    public void setLabelFr(String labelFr) { this.labelFr = labelFr; }

    public String getLabelEn() { return labelEn; }
    public void setLabelEn(String labelEn) { this.labelEn = labelEn; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public CategoryFamily getFamily() { return family; }
    public void setFamily(CategoryFamily family) { this.family = family; }

    public String getIconKey() { return iconKey; }
    public void setIconKey(String iconKey) { this.iconKey = iconKey; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public boolean isCommon() { return common; }
    public void setCommon(boolean common) { this.common = common; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
