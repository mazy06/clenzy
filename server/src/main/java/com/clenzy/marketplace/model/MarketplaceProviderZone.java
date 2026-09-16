package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Source unique des zones individuelles. userId est le propriétaire après activation ;
 * provider ne porte que la candidature tant qu'elle n'est pas liée à un compte.
 */
@Entity
@Table(name = "marketplace_provider_zones")
public class MarketplaceProviderZone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id")
    private MarketplaceProvider provider;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "arrondissement", length = 5)
    private String arrondissement;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getArrondissement() { return arrondissement; }
    public void setArrondissement(String arrondissement) { this.arrondissement = arrondissement; }

    @Column(name = "country_code", nullable = false, length = 2)
    private String countryCode = "FR";

    @Column(name = "department", length = 3)
    private String department;

    @Column(name = "city", length = 100)
    private String city;

    @Column(name = "postal_code", length = 10)
    private String postalCode;

    @Column(name = "radius_km")
    private Integer radiusKm;

    /** Zone principale : celle affichee en tete de fiche quand il y en a plusieurs. */
    @Column(name = "is_primary", nullable = false)
    private boolean primary = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public MarketplaceProvider getProvider() { return provider; }
    public void setProvider(MarketplaceProvider provider) { this.provider = provider; }

    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }

    public Integer getRadiusKm() { return radiusKm; }
    public void setRadiusKm(Integer radiusKm) { this.radiusKm = radiusKm; }

    public boolean isPrimary() { return primary; }
    public void setPrimary(boolean primary) { this.primary = primary; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
