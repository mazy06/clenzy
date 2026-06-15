package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Recommandation de prix pour un (bien, date), distincte du prix résolu par le PriceEngine
 * (CLZ-P0-17). Permet de proposer un prix suggéré + justification, puis de l'accepter/rejeter
 * sans écraser un {@link RateOverride} manuel.
 *
 * <p>Unicité par {@code (organization_id, property_id, reco_date)} : une seule recommandation
 * active par créneau (la re-proposition remplace). Le statut évolue par CAS (audit #8).</p>
 */
@Entity
@Table(name = "price_recommendations",
    uniqueConstraints = @UniqueConstraint(name = "uq_price_reco_org_property_date",
        columnNames = {"organization_id", "property_id", "reco_date"}))
public class PriceRecommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotNull
    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @NotNull
    @Column(name = "reco_date", nullable = false)
    private LocalDate recoDate;

    @NotNull
    @Column(name = "suggested_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal suggestedPrice;

    @Column(name = "base_price", precision = 12, scale = 2)
    private BigDecimal basePrice;

    @Size(max = 3)
    @Column(name = "currency", length = 3)
    private String currency;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 16)
    private PriceRecommendationSource source;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private PriceRecommendationStatus status = PriceRecommendationStatus.PROPOSED;

    @Size(max = 1024)
    @Column(name = "reason", length = 1024)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public PriceRecommendation() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public LocalDate getRecoDate() { return recoDate; }
    public void setRecoDate(LocalDate recoDate) { this.recoDate = recoDate; }

    public BigDecimal getSuggestedPrice() { return suggestedPrice; }
    public void setSuggestedPrice(BigDecimal suggestedPrice) { this.suggestedPrice = suggestedPrice; }

    public BigDecimal getBasePrice() { return basePrice; }
    public void setBasePrice(BigDecimal basePrice) { this.basePrice = basePrice; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public PriceRecommendationSource getSource() { return source; }
    public void setSource(PriceRecommendationSource source) { this.source = source; }

    public PriceRecommendationStatus getStatus() { return status; }
    public void setStatus(PriceRecommendationStatus status) { this.status = status; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
