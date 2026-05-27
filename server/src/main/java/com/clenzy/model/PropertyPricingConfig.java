package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Override manuel des parametres pricing par propriete.
 *
 * <p>Une seule ligne par {@code propertyId} (UNIQUE) — pas de versioning. L'owner
 * peut renseigner {@link #elasticityOverride} pour court-circuiter l'estimation
 * empirique automatique et imposer sa propre valeur (typiquement quand il connait
 * sa clientele : "ma villa de luxe est inelastique a 0.2").</p>
 *
 * <p>Ordre de resolution dans SimulationService :
 * <ol>
 *   <li>{@code elasticityOverride} si non-null</li>
 *   <li>{@link PropertyElasticityEstimate} si sample size suffisant</li>
 *   <li>Default 0.5</li>
 * </ol>
 */
@Entity
@Table(name = "property_pricing_config")
public class PropertyPricingConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "property_id", nullable = false, unique = true)
    private Long propertyId;

    /** Elasticite prix-demande (typiquement [0.0, 3.0]). Null = pas d'override. */
    @Column(name = "elasticity_override")
    private Double elasticityOverride;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public PropertyPricingConfig() {}

    public PropertyPricingConfig(Long propertyId, Double elasticityOverride) {
        this.propertyId = propertyId;
        this.elasticityOverride = elasticityOverride;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public Double getElasticityOverride() { return elasticityOverride; }
    public void setElasticityOverride(Double elasticityOverride) { this.elasticityOverride = elasticityOverride; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
