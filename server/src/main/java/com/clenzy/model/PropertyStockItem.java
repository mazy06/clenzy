package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Consommable en stock dans un logement (M5, vague M-B) : quantité en main, seuil
 * et quantité de réappro, consommation par ménage (décrémentée à la complétion),
 * fournisseur pour le bon de commande de la carte {@code LINEN_STOCK_ORDER}.
 */
@Entity
@Table(name = "property_stock_items")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class PropertyStockItem {

    public enum Category { LINEN, TOILETRIES, CLEANING, CONSUMABLES }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Category category = Category.LINEN;

    @Column(length = 30)
    private String unit;

    @Column(nullable = false)
    private int quantity = 0;

    @Column(name = "reorder_threshold", nullable = false)
    private int reorderThreshold = 0;

    @Column(name = "reorder_quantity", nullable = false)
    private int reorderQuantity = 0;

    /** Décrément appliqué à chaque complétion de ménage (0 = pas de conso auto). */
    @Column(name = "consumption_per_stay", nullable = false)
    private int consumptionPerStay = 0;

    @Column(name = "supplier_name", length = 200)
    private String supplierName;

    @Column(name = "supplier_email", length = 320)
    private String supplierEmail;

    @Column(name = "last_restocked_at")
    private Instant lastRestockedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public int getReorderThreshold() { return reorderThreshold; }
    public void setReorderThreshold(int reorderThreshold) { this.reorderThreshold = reorderThreshold; }
    public int getReorderQuantity() { return reorderQuantity; }
    public void setReorderQuantity(int reorderQuantity) { this.reorderQuantity = reorderQuantity; }
    public int getConsumptionPerStay() { return consumptionPerStay; }
    public void setConsumptionPerStay(int consumptionPerStay) { this.consumptionPerStay = consumptionPerStay; }
    public String getSupplierName() { return supplierName; }
    public void setSupplierName(String supplierName) { this.supplierName = supplierName; }
    public String getSupplierEmail() { return supplierEmail; }
    public void setSupplierEmail(String supplierEmail) { this.supplierEmail = supplierEmail; }
    public Instant getLastRestockedAt() { return lastRestockedAt; }
    public void setLastRestockedAt(Instant lastRestockedAt) { this.lastRestockedAt = lastRestockedAt; }
}
