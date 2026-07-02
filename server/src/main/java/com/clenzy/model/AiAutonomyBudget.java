package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * Sous-budget d'autonomie premium d'une organisation (campagne X4, ADR-007 /
 * D-105).
 *
 * <p>Enveloppe DEDIEE et PLAFONNEE pour l'autonomie proactive premium : elle
 * puise dans les poches normales ({@code ai_credit_grant}) mais son cumul de
 * cycle est borne par {@link #premiumCapMillicredits}. Au plafond,
 * {@link #onCapBehavior} decide (pause vs notifier-seulement) — jamais de
 * siphonnage de l'interactif. {@code premiumCap = 0} → autonomie premium
 * desactivee (defaut : le socle suffit).</p>
 */
@Entity
@Table(name = "ai_autonomy_budget")
public class AiAutonomyBudget {

    public static final String ON_CAP_PAUSE = "PAUSE";
    public static final String ON_CAP_NOTIFY_ONLY = "NOTIFY_ONLY";

    @Id
    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "premium_cap_millicredits", nullable = false)
    private long premiumCapMillicredits;

    @Column(name = "on_cap_behavior", nullable = false, length = 16)
    private String onCapBehavior = ON_CAP_NOTIFY_ONLY;

    /** Toggles par comportement autonome premium : {@code {"pricing_scan": true}}. JSONB. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String behaviors = "{}";

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    protected AiAutonomyBudget() {}

    public AiAutonomyBudget(Long organizationId) {
        this.organizationId = organizationId;
    }

    public void touch(String updatedBy) {
        this.updatedAt = Instant.now();
        this.updatedBy = updatedBy;
    }

    public Long getOrganizationId() { return organizationId; }
    public long getPremiumCapMillicredits() { return premiumCapMillicredits; }
    public void setPremiumCapMillicredits(long premiumCapMillicredits) {
        this.premiumCapMillicredits = premiumCapMillicredits;
    }
    public String getOnCapBehavior() { return onCapBehavior; }
    public void setOnCapBehavior(String onCapBehavior) { this.onCapBehavior = onCapBehavior; }
    public String getBehaviors() { return behaviors; }
    public void setBehaviors(String behaviors) { this.behaviors = behaviors; }
    public Instant getUpdatedAt() { return updatedAt; }
    public String getUpdatedBy() { return updatedBy; }
}
