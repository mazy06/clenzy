package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

/**
 * Tarification basee sur le nombre de voyageurs.
 *
 * Definit un nombre de voyageurs inclus dans le tarif de base (baseOccupancy)
 * et un supplement par voyageur supplementaire (extraGuestFee).
 * Un rabais optionnel peut etre applique pour les enfants.
 */
@Entity
@Table(name = "occupancy_pricing")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class OccupancyPricing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Column(name = "base_occupancy", nullable = false)
    private int baseOccupancy;

    @Column(name = "extra_guest_fee", precision = 10, scale = 2, nullable = false)
    private BigDecimal extraGuestFee;

    @Column(name = "max_occupancy", nullable = false)
    private int maxOccupancy;

    @Column(name = "child_discount", precision = 5, scale = 2)
    private BigDecimal childDiscount;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public OccupancyPricing() {}

    /**
     * Calcule le supplement par nuit pour un nombre de voyageurs donne.
     * Retourne BigDecimal.ZERO si le nombre de voyageurs est inferieur
     * ou egal a baseOccupancy.
     *
     * @param guests nombre de voyageurs adultes
     * @return supplement par nuit
     */
    public BigDecimal calculateAdjustment(int guests) {
        if (!isActive || guests <= baseOccupancy) {
            return BigDecimal.ZERO;
        }

        int extraGuests = Math.min(guests, maxOccupancy) - baseOccupancy;
        return extraGuestFee.multiply(BigDecimal.valueOf(extraGuests));
    }

    /**
     * Calcule le supplement par nuit avec distinction adultes/enfants.
     *
     * @param adults  nombre d'adultes
     * @param children nombre d'enfants
     * @return supplement par nuit
     */
    public BigDecimal calculateAdjustment(int adults, int children) {
        if (!isActive) return BigDecimal.ZERO;

        int totalGuests = adults + children;
        if (totalGuests <= baseOccupancy) return BigDecimal.ZERO;

        int extraTotal = Math.min(totalGuests, maxOccupancy) - baseOccupancy;

        // Adultes supplementaires d'abord, puis enfants (capped par extraTotal)
        int extraAdults = Math.min(Math.max(0, adults - baseOccupancy), extraTotal);
        int extraChildren = extraTotal - extraAdults;

        BigDecimal adultFee = extraGuestFee.multiply(BigDecimal.valueOf(extraAdults));

        BigDecimal childFee = BigDecimal.ZERO;
        if (extraChildren > 0 && childDiscount != null) {
            BigDecimal discountedRate = extraGuestFee
                    .multiply(BigDecimal.ONE.subtract(childDiscount.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)));
            childFee = discountedRate.multiply(BigDecimal.valueOf(extraChildren));
        } else if (extraChildren > 0) {
            childFee = extraGuestFee.multiply(BigDecimal.valueOf(extraChildren));
        }

        return adultFee.add(childFee).setScale(2, RoundingMode.HALF_UP);
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public int getBaseOccupancy() { return baseOccupancy; }
    public void setBaseOccupancy(int baseOccupancy) { this.baseOccupancy = baseOccupancy; }

    public BigDecimal getExtraGuestFee() { return extraGuestFee; }
    public void setExtraGuestFee(BigDecimal extraGuestFee) { this.extraGuestFee = extraGuestFee; }

    public int getMaxOccupancy() { return maxOccupancy; }
    public void setMaxOccupancy(int maxOccupancy) { this.maxOccupancy = maxOccupancy; }

    public BigDecimal getChildDiscount() { return childDiscount; }
    public void setChildDiscount(BigDecimal childDiscount) { this.childDiscount = childDiscount; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public String toString() {
        return "OccupancyPricing{id=" + id + ", baseOccupancy=" + baseOccupancy
                + ", extraGuestFee=" + extraGuestFee + ", maxOccupancy=" + maxOccupancy
                + ", active=" + isActive + "}";
    }
}
