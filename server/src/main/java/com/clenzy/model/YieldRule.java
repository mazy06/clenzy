package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Regle de yield management (tarification dynamique).
 *
 * Permet d'ajuster automatiquement les prix en fonction de
 * conditions de marche : taux d'occupation, delai avant arrivee,
 * remplissage derniere minute, comblage de gaps.
 *
 * La triggerCondition est stockee en JSONB et contient les parametres
 * specifiques au ruleType (ex: {"occupancyAbove": 80, "daysAhead": 30}).
 *
 * Si property est null, la regle s'applique a toutes les proprietes
 * de l'organisation.
 */
@Entity
@Table(name = "yield_rules")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class YieldRule {

    public enum RuleType {
        OCCUPANCY_THRESHOLD,    // Ajustement selon le taux d'occupation
        DAYS_BEFORE_ARRIVAL,    // Ajustement selon le delai avant arrivee
        LAST_MINUTE_FILL,       // Remplissage derniere minute
        GAP_FILL                // Comblage de gaps entre reservations
    }

    public enum AdjustmentType {
        PERCENTAGE,
        FIXED_AMOUNT
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    private Property property;

    @Column(length = 100, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "rule_type", length = 30, nullable = false)
    private RuleType ruleType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "trigger_condition", columnDefinition = "jsonb", nullable = false)
    private String triggerCondition;

    @Enumerated(EnumType.STRING)
    @Column(name = "adjustment_type", length = 20, nullable = false)
    private AdjustmentType adjustmentType;

    @Column(name = "adjustment_value", precision = 10, scale = 2, nullable = false)
    private BigDecimal adjustmentValue;

    @Column(name = "min_price", precision = 10, scale = 2)
    private BigDecimal minPrice;

    @Column(name = "max_price", precision = 10, scale = 2)
    private BigDecimal maxPrice;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(nullable = false)
    private int priority = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public YieldRule() {}

    /**
     * Applique les bornes min/max au prix calcule.
     */
    public BigDecimal clampPrice(BigDecimal price) {
        if (price == null) return null;
        if (minPrice != null && price.compareTo(minPrice) < 0) return minPrice;
        if (maxPrice != null && price.compareTo(maxPrice) > 0) return maxPrice;
        return price;
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public RuleType getRuleType() { return ruleType; }
    public void setRuleType(RuleType ruleType) { this.ruleType = ruleType; }

    public String getTriggerCondition() { return triggerCondition; }
    public void setTriggerCondition(String triggerCondition) { this.triggerCondition = triggerCondition; }

    public AdjustmentType getAdjustmentType() { return adjustmentType; }
    public void setAdjustmentType(AdjustmentType adjustmentType) { this.adjustmentType = adjustmentType; }

    public BigDecimal getAdjustmentValue() { return adjustmentValue; }
    public void setAdjustmentValue(BigDecimal adjustmentValue) { this.adjustmentValue = adjustmentValue; }

    public BigDecimal getMinPrice() { return minPrice; }
    public void setMinPrice(BigDecimal minPrice) { this.minPrice = minPrice; }

    public BigDecimal getMaxPrice() { return maxPrice; }
    public void setMaxPrice(BigDecimal maxPrice) { this.maxPrice = maxPrice; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public String toString() {
        return "YieldRule{id=" + id + ", name='" + name + "', type=" + ruleType
                + ", adjustment=" + adjustmentType + " " + adjustmentValue
                + ", active=" + isActive + "}";
    }
}
