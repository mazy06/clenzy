package com.clenzy.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Journal d'audit des modifications tarifaires.
 *
 * Historisation obligatoire 2 ans (exigence certification OTA).
 * Pas de @Filter("organizationFilter") : le SUPER_ADMIN peut
 * auditer toutes les organisations.
 *
 * Trace toutes les modifications de prix : modifications manuelles,
 * regles de yield, sync channel, changements de plans tarifaires.
 */
@Entity
@Table(name = "rate_audit_log")
public class RateAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column
    private LocalDate date;

    @Column(name = "rate_plan_id")
    private Long ratePlanId;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "previous_price", precision = 10, scale = 2)
    private BigDecimal previousPrice;

    @Column(name = "new_price", precision = 10, scale = 2)
    private BigDecimal newPrice;

    @Column(name = "changed_by", length = 255)
    private String changedBy;

    @Column(length = 50)
    private String source;

    @Column(name = "rule_name", length = 100)
    private String ruleName;

    @Column(name = "channel_name", length = 50)
    private String channelName;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt = LocalDateTime.now();

    // Constructeurs

    public RateAuditLog() {}

    /**
     * Constructeur legacy (compatibilite arriere).
     */
    public RateAuditLog(Long organizationId, Long propertyId, LocalDate date,
                        String oldValue, String newValue, String changedBy, String source) {
        this.organizationId = organizationId;
        this.propertyId = propertyId;
        this.date = date;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.changedBy = changedBy;
        this.source = source;
    }

    /**
     * Constructeur pour l'audit de prix numerique (Advanced Rate Manager).
     */
    public RateAuditLog(Long organizationId, Long propertyId, LocalDate date,
                        BigDecimal previousPrice, BigDecimal newPrice,
                        String source, String changedBy, String ruleName) {
        this.organizationId = organizationId;
        this.propertyId = propertyId;
        this.date = date;
        this.previousPrice = previousPrice;
        this.newPrice = newPrice;
        this.source = source;
        this.changedBy = changedBy;
        this.ruleName = ruleName;
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public Long getRatePlanId() { return ratePlanId; }
    public void setRatePlanId(Long ratePlanId) { this.ratePlanId = ratePlanId; }

    public String getOldValue() { return oldValue; }
    public void setOldValue(String oldValue) { this.oldValue = oldValue; }

    public String getNewValue() { return newValue; }
    public void setNewValue(String newValue) { this.newValue = newValue; }

    public BigDecimal getPreviousPrice() { return previousPrice; }
    public void setPreviousPrice(BigDecimal previousPrice) { this.previousPrice = previousPrice; }

    public BigDecimal getNewPrice() { return newPrice; }
    public void setNewPrice(BigDecimal newPrice) { this.newPrice = newPrice; }

    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String changedBy) { this.changedBy = changedBy; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getRuleName() { return ruleName; }
    public void setRuleName(String ruleName) { this.ruleName = ruleName; }

    public String getChannelName() { return channelName; }
    public void setChannelName(String channelName) { this.channelName = channelName; }

    public LocalDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(LocalDateTime changedAt) { this.changedAt = changedAt; }
}
