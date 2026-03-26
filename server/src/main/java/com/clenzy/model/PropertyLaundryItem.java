package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Article de linge a laver apres chaque sejour pour une propriete.
 * Le {@code itemKey} correspond a une cle du catalogue blanchisserie
 * defini dans {@link com.clenzy.model.PricingConfig}.
 */
@Entity
@Table(name = "property_laundry_items",
       uniqueConstraints = @UniqueConstraint(columnNames = {"property_id", "item_key"}))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PropertyLaundryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "item_key", nullable = false, length = 100)
    private String itemKey;

    @Column(nullable = false)
    private String label;

    @Column(name = "quantity_per_stay", nullable = false)
    private int quantityPerStay = 1;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public PropertyLaundryItem() {}

    // ── Getters / Setters ────────────────────────────────────────────────

    public Long getId() { return id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getItemKey() { return itemKey; }
    public void setItemKey(String itemKey) { this.itemKey = itemKey; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public int getQuantityPerStay() { return quantityPerStay; }
    public void setQuantityPerStay(int quantityPerStay) { this.quantityPerStay = quantityPerStay; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
