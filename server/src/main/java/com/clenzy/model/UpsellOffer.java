package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Service additionnel proposé par l'hôte au guest (early check-in, ménage, transfert…),
 * payable depuis le livret. {@code propertyId} null = offre valable pour toutes les
 * propriétés de l'org. Toujours interrogée par org/property explicite (pas de filtre tenant).
 */
@Entity
@Table(name = "upsell_offers", indexes = {
        @Index(name = "idx_upsell_offers_org", columnList = "organization_id"),
        @Index(name = "idx_upsell_offers_property", columnList = "property_id")
})
public class UpsellOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Null = offre valable pour toutes les propriétés de l'org. */
    @Column(name = "property_id")
    private Long propertyId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private UpsellType type = UpsellType.OTHER;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(nullable = false, length = 3)
    private String currency = "EUR";

    /** Image du service : data URL base64 (stockée en base) ou URL legacy. */
    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    /** Conditionnel (2.10) : nb de nuits minimal du séjour pour proposer l'offre (NULL = pas de condition). */
    @Column(name = "min_nights")
    private Integer minNights;

    /** Fenêtre horaire (2.10) : délai mini (heures) avant l'arrivée pour pouvoir commander (NULL = aucun). */
    @Column(name = "lead_time_hours")
    private Integer leadTimeHours;

    /** Bundle (2.10) : CSV des ids d'offres incluses ; non vide = cette offre est un bundle à prix combiné. */
    @Column(name = "bundle_offer_ids", length = 500)
    private String bundleOfferIds;

    /** Diffusion par canal : proposé dans le livret numérique (défaut TRUE). */
    @Column(name = "diffuse_on_livret", nullable = false)
    private boolean diffuseOnLivret = true;

    /** Diffusion par canal : proposé dans le booking engine (défaut TRUE). */
    @Column(name = "diffuse_on_booking", nullable = false)
    private boolean diffuseOnBooking = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public UpsellType getType() { return type; }
    public void setType(UpsellType type) { this.type = type; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public Integer getMinNights() { return minNights; }
    public void setMinNights(Integer minNights) { this.minNights = minNights; }
    public Integer getLeadTimeHours() { return leadTimeHours; }
    public void setLeadTimeHours(Integer leadTimeHours) { this.leadTimeHours = leadTimeHours; }
    public String getBundleOfferIds() { return bundleOfferIds; }
    public void setBundleOfferIds(String bundleOfferIds) { this.bundleOfferIds = bundleOfferIds; }
    public boolean isDiffuseOnLivret() { return diffuseOnLivret; }
    public void setDiffuseOnLivret(boolean diffuseOnLivret) { this.diffuseOnLivret = diffuseOnLivret; }
    public boolean isDiffuseOnBooking() { return diffuseOnBooking; }
    public void setDiffuseOnBooking(boolean diffuseOnBooking) { this.diffuseOnBooking = diffuseOnBooking; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
