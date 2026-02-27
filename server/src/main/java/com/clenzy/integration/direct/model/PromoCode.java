package com.clenzy.integration.direct.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Code promotionnel applicable aux reservations directes.
 * Si propertyId est null, le code s'applique a toutes les proprietes de l'organisation.
 */
@Entity
@Table(name = "promo_codes",
       uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id", "code"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class PromoCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id")
    private Long propertyId;

    @Column(nullable = false, length = 50)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false, length = 20)
    private DiscountType discountType;

    @Column(name = "discount_value", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountValue;

    @Column(name = "valid_from")
    private LocalDate validFrom;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Column(name = "min_nights")
    private int minNights;

    @Column(name = "max_uses")
    private int maxUses;

    @Column(name = "current_uses", nullable = false)
    private int currentUses = 0;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs

    public PromoCode() {}

    public PromoCode(Long organizationId, String code, DiscountType discountType, BigDecimal discountValue) {
        this.organizationId = organizationId;
        this.code = code;
        this.discountType = discountType;
        this.discountValue = discountValue;
    }

    // Types de reduction

    public enum DiscountType {
        PERCENTAGE,
        FIXED_AMOUNT
    }

    // Methodes metier

    /**
     * Verifie si le code promo est valide a la date donnee.
     */
    public boolean isValidAt(LocalDate date) {
        if (!active) return false;
        if (maxUses > 0 && currentUses >= maxUses) return false;
        if (validFrom != null && date.isBefore(validFrom)) return false;
        if (validUntil != null && date.isAfter(validUntil)) return false;
        return true;
    }

    /**
     * Verifie si le code s'applique a une propriete donnee.
     */
    public boolean appliesTo(Long targetPropertyId) {
        return propertyId == null || propertyId.equals(targetPropertyId);
    }

    /**
     * Calcule la reduction applicable sur un montant total.
     */
    public BigDecimal computeDiscount(BigDecimal totalAmount) {
        return switch (discountType) {
            case PERCENTAGE -> totalAmount.multiply(discountValue)
                    .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
            case FIXED_AMOUNT -> discountValue.min(totalAmount);
        };
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public DiscountType getDiscountType() { return discountType; }
    public void setDiscountType(DiscountType discountType) { this.discountType = discountType; }

    public BigDecimal getDiscountValue() { return discountValue; }
    public void setDiscountValue(BigDecimal discountValue) { this.discountValue = discountValue; }

    public LocalDate getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDate validFrom) { this.validFrom = validFrom; }

    public LocalDate getValidUntil() { return validUntil; }
    public void setValidUntil(LocalDate validUntil) { this.validUntil = validUntil; }

    public int getMinNights() { return minNights; }
    public void setMinNights(int minNights) { this.minNights = minNights; }

    public int getMaxUses() { return maxUses; }
    public void setMaxUses(int maxUses) { this.maxUses = maxUses; }

    public int getCurrentUses() { return currentUses; }
    public void setCurrentUses(int currentUses) { this.currentUses = currentUses; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public String toString() {
        return "PromoCode{id=" + id
                + ", code='" + code + "'"
                + ", type=" + discountType
                + ", value=" + discountValue
                + ", active=" + active + "}";
    }
}
