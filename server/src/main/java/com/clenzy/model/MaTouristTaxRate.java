package com.clenzy.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Taxe de sejour au Maroc : fourchette legale par categorie ({@code cityKey = "*"}) ou tarif
 * connu d'une ville. Donnee PLATEFORME publique : pas d'organisation, pas de filtre tenant.
 */
@Entity
@Table(name = "ma_tourist_tax_rates")
public class MaTouristTaxRate {

    /**
     * Categories de l'article 73 de la loi 47-06 modifiee par la loi 07-20. Un logement loue
     * aux touristes (appartement, maison, riad) releve de {@link #RIAD_MAISON}.
     */
    public enum Category {
        MAISON_HOTES, HOTEL_5, HOTEL_4, HOTEL_3, HOTEL_1_2, CLUB, RIAD_MAISON, VILLAGE_VACANCES,
        RESIDENCE_TOURISTIQUE, AUTRES
    }

    /** Cle des lignes valables partout (fourchettes legales). */
    public static final String NATIONAL = "*";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "city_key", nullable = false, length = 80)
    private String cityKey;

    @Column(name = "city_label", nullable = false, length = 120)
    private String cityLabel;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 40)
    private Category category;

    @Column(name = "min_rate", precision = 8, scale = 2)
    private BigDecimal minRate;

    @Column(name = "max_rate", precision = 8, scale = 2)
    private BigDecimal maxRate;

    @Column(name = "rate", precision = 8, scale = 2)
    private BigDecimal rate;

    @Column(name = "source_label", nullable = false, length = 300)
    private String sourceLabel;

    @Column(name = "source_url", length = 500)
    private String sourceUrl;

    @Column(name = "as_of")
    private LocalDate asOf;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    public Long getId() { return id; }
    public String getCityKey() { return cityKey; }
    public void setCityKey(String cityKey) { this.cityKey = cityKey; }
    public String getCityLabel() { return cityLabel; }
    public void setCityLabel(String cityLabel) { this.cityLabel = cityLabel; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public BigDecimal getMinRate() { return minRate; }
    public void setMinRate(BigDecimal minRate) { this.minRate = minRate; }
    public BigDecimal getMaxRate() { return maxRate; }
    public void setMaxRate(BigDecimal maxRate) { this.maxRate = maxRate; }
    public BigDecimal getRate() { return rate; }
    public void setRate(BigDecimal rate) { this.rate = rate; }
    public String getSourceLabel() { return sourceLabel; }
    public void setSourceLabel(String sourceLabel) { this.sourceLabel = sourceLabel; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public LocalDate getAsOf() { return asOf; }
    public void setAsOf(LocalDate asOf) { this.asOf = asOf; }
    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }
}
