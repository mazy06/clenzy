package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Service optionnel individuel rattache a une categorie.
 * Exemples : "Bouquet de roses", "Petit-dejeuner continental", "Late check-out".
 * Multi-tenant via @Filter.
 */
@Entity
@Table(name = "booking_service_items",
    indexes = {
        @Index(name = "idx_bsi_cat_sort", columnList = "category_id, sort_order"),
        @Index(name = "idx_bsi_org", columnList = "organization_id")
    }
)
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class BookingServiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private BookingServiceCategory category;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(nullable = false, length = 300)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_mode", nullable = false, length = 20)
    private BookingServicePricingMode pricingMode = BookingServicePricingMode.PER_BOOKING;

    @Enumerated(EnumType.STRING)
    @Column(name = "input_type", nullable = false, length = 20)
    private BookingServiceInputType inputType = BookingServiceInputType.CHECKBOX;

    @Column(name = "max_quantity")
    private Integer maxQuantity = 10;

    @Column(nullable = false)
    private boolean mandatory = false;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // ─── Getters / Setters ──────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public BookingServiceCategory getCategory() { return category; }
    public void setCategory(BookingServiceCategory category) { this.category = category; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public BookingServicePricingMode getPricingMode() { return pricingMode; }
    public void setPricingMode(BookingServicePricingMode pricingMode) { this.pricingMode = pricingMode; }

    public BookingServiceInputType getInputType() { return inputType; }
    public void setInputType(BookingServiceInputType inputType) { this.inputType = inputType; }

    public Integer getMaxQuantity() { return maxQuantity; }
    public void setMaxQuantity(Integer maxQuantity) { this.maxQuantity = maxQuantity; }

    public boolean isMandatory() { return mandatory; }
    public void setMandatory(boolean mandatory) { this.mandatory = mandatory; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
