package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Prestation type du catalogue.
 *
 * <h2>Pourquoi un catalogue plutot que du texte libre</h2>
 * <p>Une prestation n'etait qu'un libelle saisi a la main. Dix professionnels
 * ecrivaient « menage fin de sejour », « Menage sortie », « nettoyage apres
 * depart » : trois libelles pour une seule prestation, donc aucun filtre
 * possible et aucune comparaison de prix.</p>
 *
 * <p><b>Le champ libre survit a cote.</b> Un metier absent de la liste doit
 * quand meme pouvoir se vendre — c'est tout l'objet d'une place de marche
 * ouverte. Le lien depuis {@link MarketplaceProviderOffer} est donc facultatif.</p>
 */
@Entity
@Table(name = "marketplace_service_items")
public class MarketplaceServiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, length = 60)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private MarketplaceServiceCategory category;

    @Column(name = "label_fr", nullable = false, length = 120)
    private String labelFr;

    @Column(name = "label_en", nullable = false, length = 120)
    private String labelEn;

    @Column(name = "description", length = 300)
    private String description;

    /** Modele de prix pre-rempli quand un professionnel choisit cette prestation. */
    @Enumerated(EnumType.STRING)
    @Column(name = "default_pricing_model", nullable = false, length = 20)
    private PricingModel defaultPricingModel = PricingModel.ON_QUOTE;

    @Enumerated(EnumType.STRING)
    @Column(name = "recurrence", nullable = false, length = 20)
    private ServiceRecurrence recurrence = ServiceRecurrence.ONE_OFF;

    @Enumerated(EnumType.STRING)
    @Column(name = "payer", nullable = false, length = 10)
    private ServicePayer payer = ServicePayer.OWNER;

    /** true si la prestation peut devenir une vente additionnelle au voyageur. */
    @Column(name = "guest_sellable", nullable = false)
    private boolean guestSellable = false;

    /**
     * Prestation IMPOSEE par la loi (diagnostics, ramonage, entretien de
     * chaudiere, controle du dispositif de securite piscine...).
     *
     * <p>Ce sont les plus previsibles du catalogue : elles reviennent qu'on le
     * veuille ou non. Les distinguer permet de les traiter comme un calendrier
     * d'obligations plutot que comme un rayon parmi d'autres.</p>
     */
    @Column(name = "regulated", nullable = false)
    private boolean regulated = false;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "active", nullable = false)
    private boolean active = true;

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

    public MarketplaceServiceCategory getCategory() { return category; }
    public void setCategory(MarketplaceServiceCategory category) { this.category = category; }

    public String getLabelFr() { return labelFr; }
    public void setLabelFr(String labelFr) { this.labelFr = labelFr; }

    public String getLabelEn() { return labelEn; }
    public void setLabelEn(String labelEn) { this.labelEn = labelEn; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public PricingModel getDefaultPricingModel() { return defaultPricingModel; }
    public void setDefaultPricingModel(PricingModel defaultPricingModel) { this.defaultPricingModel = defaultPricingModel; }

    public ServiceRecurrence getRecurrence() { return recurrence; }
    public void setRecurrence(ServiceRecurrence recurrence) { this.recurrence = recurrence; }

    public ServicePayer getPayer() { return payer; }
    public void setPayer(ServicePayer payer) { this.payer = payer; }

    public boolean isGuestSellable() { return guestSellable; }
    public void setGuestSellable(boolean guestSellable) { this.guestSellable = guestSellable; }

    public boolean isRegulated() { return regulated; }
    public void setRegulated(boolean regulated) { this.regulated = regulated; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
