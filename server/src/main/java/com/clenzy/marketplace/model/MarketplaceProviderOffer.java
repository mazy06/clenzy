package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Une prestation vendue par un professionnel, avec son propre modele de prix.
 *
 * <p>Un professionnel en expose autant qu'il veut, dans plusieurs categories :
 * une conciergerie peut vendre du menage, de la blanchisserie et de l'accueil
 * voyageurs sans que cela fasse trois fiches.</p>
 *
 * <p>Mappee sur {@code marketplace_provider_services} ; nommee « Offer » cote
 * Java pour ne pas entrer en collision avec les classes de service Spring.</p>
 */
@Entity
@Table(name = "marketplace_provider_services")
public class MarketplaceProviderOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private MarketplaceProvider provider;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tariff_id")
    private com.clenzy.model.ProviderTariff tariff;

    public com.clenzy.model.ProviderTariff getTariff() { return tariff; }
    public void setTariff(com.clenzy.model.ProviderTariff value) { tariff = value; }

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private MarketplaceServiceCategory category;

    /**
     * Prestation du catalogue, quand elle correspond a une entree connue.
     *
     * <p>FACULTATIF a dessein : un metier absent du referentiel doit quand meme
     * pouvoir se vendre. L'offre garde alors son seul {@link #label} libre —
     * c'est ce qui fait la difference entre un catalogue ferme et une place de
     * marche ouverte.</p>
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_item_id")
    private MarketplaceServiceItem serviceItem;

    @Column(name = "label", nullable = false, length = 120)
    private String label;

    @Column(name = "description", length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_model", nullable = false, length = 20)
    private PricingModel pricingModel = PricingModel.ON_QUOTE;

    /** Vide lorsque {@link PricingModel#ON_QUOTE} : un prix absent vaut mieux qu'un prix faux. */
    @Column(name = "amount", precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "EUR";

    /** Unite facturee lorsque le modele est {@link PricingModel#PER_UNIT} (trajet, kilo, piece...). */
    @Column(name = "unit_label", length = 40)
    private String unitLabel;

    @Column(name = "min_duration_minutes")
    private Integer minDurationMinutes;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public MarketplaceProvider getProvider() { return provider; }
    public void setProvider(MarketplaceProvider provider) { this.provider = provider; }

    public MarketplaceServiceCategory getCategory() { return category; }
    public void setCategory(MarketplaceServiceCategory category) { this.category = category; }

    public MarketplaceServiceItem getServiceItem() { return serviceItem; }
    public void setServiceItem(MarketplaceServiceItem serviceItem) { this.serviceItem = serviceItem; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public PricingModel getPricingModel() { return tariff != null ? tariff.getPricingModel() : pricingModel; }
    public void setPricingModel(PricingModel pricingModel) { this.pricingModel = pricingModel; }

    public BigDecimal getAmount() { return tariff != null ? tariff.getAmount() : amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getCurrency() { return tariff != null ? tariff.getCurrency() : currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getUnitLabel() { return tariff != null ? tariff.getUnitLabel() : unitLabel; }
    public void setUnitLabel(String unitLabel) { this.unitLabel = unitLabel; }

    public Integer getMinDurationMinutes() { return minDurationMinutes; }
    public void setMinDurationMinutes(Integer minDurationMinutes) { this.minDurationMinutes = minDurationMinutes; }

    public boolean isActive() { return active && (tariff == null || tariff.isEnabled()); }
    public void setActive(boolean active) { this.active = active; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
