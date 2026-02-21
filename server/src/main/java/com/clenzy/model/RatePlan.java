package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;

/**
 * Plan tarifaire pour une propriete.
 *
 * Chaque propriete peut avoir plusieurs plans tarifaires actifs.
 * La resolution du prix pour une date donnee suit l'algorithme :
 * RateOverride > PROMOTIONAL > SEASONAL > LAST_MINUTE > BASE > Property.nightlyPrice
 *
 * Au sein d'un meme type, le plan avec la priorite la plus haute gagne.
 */
@Entity
@Table(name = "rate_plans")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class RatePlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Column(length = 100, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(length = 30, nullable = false)
    private RatePlanType type;

    @Column(nullable = false)
    private Integer priority = 0;

    @Column(name = "nightly_price", precision = 10, scale = 2, nullable = false)
    private BigDecimal nightlyPrice;

    @Column(length = 3, nullable = false)
    private String currency = "EUR";

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "days_of_week", columnDefinition = "INTEGER[]")
    private Integer[] daysOfWeek;

    @Column(name = "min_stay_override")
    private Integer minStayOverride;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs

    public RatePlan() {}

    public RatePlan(Property property, String name, RatePlanType type,
                    BigDecimal nightlyPrice, Long organizationId) {
        this.property = property;
        this.name = name;
        this.type = type;
        this.nightlyPrice = nightlyPrice;
        this.organizationId = organizationId;
    }

    // Methodes metier

    /**
     * Verifie si ce plan tarifaire s'applique a une date donnee.
     * Conditions : actif + date dans [startDate, endDate] + jour de la semaine.
     */
    public boolean appliesTo(LocalDate date) {
        if (!Boolean.TRUE.equals(isActive)) return false;
        if (startDate != null && date.isBefore(startDate)) return false;
        if (endDate != null && date.isAfter(endDate)) return false;
        if (daysOfWeek != null && daysOfWeek.length > 0) {
            int dayOfWeek = date.getDayOfWeek().getValue(); // 1=Lundi, 7=Dimanche
            return Arrays.asList(daysOfWeek).contains(dayOfWeek);
        }
        return true;
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

    public RatePlanType getType() { return type; }
    public void setType(RatePlanType type) { this.type = type; }

    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }

    public BigDecimal getNightlyPrice() { return nightlyPrice; }
    public void setNightlyPrice(BigDecimal nightlyPrice) { this.nightlyPrice = nightlyPrice; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public Integer[] getDaysOfWeek() { return daysOfWeek; }
    public void setDaysOfWeek(Integer[] daysOfWeek) { this.daysOfWeek = daysOfWeek; }

    public Integer getMinStayOverride() { return minStayOverride; }
    public void setMinStayOverride(Integer minStayOverride) { this.minStayOverride = minStayOverride; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public String toString() {
        return "RatePlan{id=" + id + ", name='" + name + "', type=" + type
                + ", nightlyPrice=" + nightlyPrice + ", isActive=" + isActive + "}";
    }
}
