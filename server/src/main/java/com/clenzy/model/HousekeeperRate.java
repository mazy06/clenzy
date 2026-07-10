package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Tarif d'un prestataire ménage (Moteur Ménage, Phase 2A — pattern Turno).
 *
 * <p>Deux formes :
 * <ul>
 *   <li>{@code propertyId == null} + {@link RateUnit#HOURLY} : taux horaire général du pro ;</li>
 *   <li>{@code propertyId != null} + {@link RateUnit#FLAT} : forfait pour CE logement,
 *       qui PRIME sur le taux horaire dans {@code CleaningPricingEngine.resolveCleaningPrice}.</li>
 * </ul>
 * Le forfait est exprimé pour le ménage STANDARD (CLEANING) ; les autres types
 * se dérivent par le ratio des multiplicateurs du moteur.</p>
 */
@Entity
@Table(name = "housekeeper_rates")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class HousekeeperRate {

    public enum RateUnit { HOURLY, FLAT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Le housekeeper (users.id). */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** NULL = taux général ; sinon forfait pour ce logement. */
    @Column(name = "property_id")
    private Long propertyId;

    @Column(name = "amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit", nullable = false, length = 10)
    private RateUnit unit;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public HousekeeperRate() {
    }

    public HousekeeperRate(Long organizationId, Long userId, Long propertyId, BigDecimal amount, RateUnit unit) {
        this.organizationId = organizationId;
        this.userId = userId;
        this.propertyId = propertyId;
        this.amount = amount;
        this.unit = unit;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public RateUnit getUnit() { return unit; }
    public void setUnit(RateUnit unit) { this.unit = unit; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
