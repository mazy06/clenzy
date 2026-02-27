package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Remise basee sur la duree du sejour.
 *
 * Permet d'offrir des reductions pour les sejours longs
 * (ex: -10% a partir de 7 nuits, -20% a partir de 28 nuits).
 *
 * Si property est null, la remise s'applique a toutes les proprietes
 * de l'organisation.
 */
@Entity
@Table(name = "length_of_stay_discounts")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class LengthOfStayDiscount {

    public enum DiscountType {
        PERCENTAGE,
        FIXED_PER_NIGHT
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    private Property property;

    @Column(name = "min_nights", nullable = false)
    private int minNights;

    @Column(name = "max_nights")
    private Integer maxNights;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", length = 20, nullable = false)
    private DiscountType discountType;

    @Column(name = "discount_value", precision = 10, scale = 2, nullable = false)
    private BigDecimal discountValue;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public LengthOfStayDiscount() {}

    /**
     * Verifie si cette remise s'applique pour un nombre de nuits donne.
     */
    public boolean appliesTo(int nights) {
        if (!isActive) return false;
        if (nights < minNights) return false;
        if (maxNights != null && nights > maxNights) return false;
        return true;
    }

    /**
     * Verifie si cette remise est valide pour une date donnee.
     */
    public boolean isValidForDate(LocalDate date) {
        if (startDate != null && date.isBefore(startDate)) return false;
        if (endDate != null && date.isAfter(endDate)) return false;
        return true;
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public int getMinNights() { return minNights; }
    public void setMinNights(int minNights) { this.minNights = minNights; }

    public Integer getMaxNights() { return maxNights; }
    public void setMaxNights(Integer maxNights) { this.maxNights = maxNights; }

    public DiscountType getDiscountType() { return discountType; }
    public void setDiscountType(DiscountType discountType) { this.discountType = discountType; }

    public BigDecimal getDiscountValue() { return discountValue; }
    public void setDiscountValue(BigDecimal discountValue) { this.discountValue = discountValue; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public String toString() {
        return "LengthOfStayDiscount{id=" + id + ", minNights=" + minNights
                + ", maxNights=" + maxNights + ", type=" + discountType
                + ", value=" + discountValue + ", active=" + isActive + "}";
    }
}
