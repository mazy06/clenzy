package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

/**
 * Configuration globale du calendrier de generation automatique des reversements.
 * Table singleton : un seul row dans la base, upsert via l'application.
 */
@Entity
@Table(name = "payout_schedule_config")
public class PayoutScheduleConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "payout_days_of_month", columnDefinition = "integer[]", nullable = false)
    private List<Integer> payoutDaysOfMonth;

    @Column(name = "grace_period_days", nullable = false)
    private int gracePeriodDays = 2;

    @Column(name = "auto_generate_enabled", nullable = false)
    private boolean autoGenerateEnabled = true;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    protected void onSave() {
        updatedAt = Instant.now();
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public List<Integer> getPayoutDaysOfMonth() { return payoutDaysOfMonth; }
    public void setPayoutDaysOfMonth(List<Integer> payoutDaysOfMonth) { this.payoutDaysOfMonth = payoutDaysOfMonth; }
    public int getGracePeriodDays() { return gracePeriodDays; }
    public void setGracePeriodDays(int gracePeriodDays) { this.gracePeriodDays = gracePeriodDays; }
    public boolean isAutoGenerateEnabled() { return autoGenerateEnabled; }
    public void setAutoGenerateEnabled(boolean autoGenerateEnabled) { this.autoGenerateEnabled = autoGenerateEnabled; }
    public Instant getUpdatedAt() { return updatedAt; }
}
