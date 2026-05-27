package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Cache de l'elasticite prix-demande estimee empiriquement par
 * {@code EmpiricalElasticityEstimator} sur l'historique de reservations 12 mois.
 *
 * <p>Une seule ligne par propriete (UNIQUE). Recalculee hebdo par le scheduler
 * dedie. Le {@link #sampleSize} indique le nombre de paires (delta_price%,
 * delta_occupancy%) qui ont nourri la regression : en dessous de 3, l'estimation
 * est consideree comme trop bruyante et le caller fait fallback sur le default.</p>
 */
@Entity
@Table(name = "property_elasticity_estimate")
public class PropertyElasticityEstimate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "property_id", nullable = false, unique = true)
    private Long propertyId;

    /** Elasticite calculee (toujours positive — convention industrie). */
    @Column(name = "elasticity_value", nullable = false)
    private double elasticityValue;

    /** Nombre de paires utilisees pour la regression (>= 3 pour etre fiable). */
    @Column(name = "sample_size", nullable = false)
    private int sampleSize;

    @Column(name = "computed_at", nullable = false)
    private LocalDateTime computedAt = LocalDateTime.now();

    public PropertyElasticityEstimate() {}

    public PropertyElasticityEstimate(Long propertyId, double elasticityValue, int sampleSize) {
        this.propertyId = propertyId;
        this.elasticityValue = elasticityValue;
        this.sampleSize = sampleSize;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public double getElasticityValue() { return elasticityValue; }
    public void setElasticityValue(double elasticityValue) { this.elasticityValue = elasticityValue; }
    public int getSampleSize() { return sampleSize; }
    public void setSampleSize(int sampleSize) { this.sampleSize = sampleSize; }
    public LocalDateTime getComputedAt() { return computedAt; }
    public void setComputedAt(LocalDateTime computedAt) { this.computedAt = computedAt; }
}
