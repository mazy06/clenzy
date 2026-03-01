package com.clenzy.model;

import com.clenzy.integration.channel.ChannelName;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Ajustement tarifaire par channel de distribution.
 *
 * Permet de definir des tarifs derives par channel (ex: +10% sur Booking,
 * -5 EUR sur le site direct). Les modifiers sont appliques apres la resolution
 * du prix de base par le PriceEngine.
 *
 * Si property est null, le modifier s'applique a toutes les proprietes
 * de l'organisation.
 */
@Entity
@Table(name = "channel_rate_modifiers")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class ChannelRateModifier {

    public enum ModifierType {
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

    @Enumerated(EnumType.STRING)
    @Column(name = "channel_name", length = 50, nullable = false)
    private ChannelName channelName;

    @Enumerated(EnumType.STRING)
    @Column(name = "modifier_type", length = 20, nullable = false)
    private ModifierType modifierType;

    @Column(name = "modifier_value", precision = 10, scale = 2, nullable = false)
    private BigDecimal modifierValue;

    @Column(length = 255)
    private String description;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(nullable = false)
    private int priority = 0;

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

    public ChannelRateModifier() {}

    /**
     * Applique ce modifier au prix de base.
     * PERCENTAGE : basePrice + (basePrice * modifierValue / 100)
     * FIXED_AMOUNT : basePrice + modifierValue
     *
     * Le modifierValue peut etre negatif pour des reductions.
     */
    public BigDecimal applyTo(BigDecimal basePrice) {
        if (basePrice == null) return null;

        return switch (modifierType) {
            case PERCENTAGE -> {
                BigDecimal adjustment = basePrice
                        .multiply(modifierValue)
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                yield basePrice.add(adjustment).max(BigDecimal.ZERO);
            }
            case FIXED_AMOUNT -> basePrice.add(modifierValue).max(BigDecimal.ZERO);
        };
    }

    /**
     * Verifie si ce modifier s'applique a une date donnee.
     */
    public boolean appliesTo(LocalDate date) {
        if (!isActive) return false;
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

    public ChannelName getChannelName() { return channelName; }
    public void setChannelName(ChannelName channelName) { this.channelName = channelName; }

    public ModifierType getModifierType() { return modifierType; }
    public void setModifierType(ModifierType modifierType) { this.modifierType = modifierType; }

    public BigDecimal getModifierValue() { return modifierValue; }
    public void setModifierValue(BigDecimal modifierValue) { this.modifierValue = modifierValue; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public String toString() {
        return "ChannelRateModifier{id=" + id + ", channel=" + channelName
                + ", type=" + modifierType + ", value=" + modifierValue
                + ", active=" + isActive + "}";
    }
}
