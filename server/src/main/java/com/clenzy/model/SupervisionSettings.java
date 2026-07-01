package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Réglage org-level de la constellation Superviseur d'agents (master).
 *
 * <p>Une ligne par organisation. {@code enabled} = interrupteur global de la
 * feature (désactivé par défaut → aucun changement tant que l'org n'active pas).
 * La config par module vit dans {@link SupervisionModuleSettings}.</p>
 */
@Entity
@Table(name = "supervision_settings", indexes = {
        @Index(name = "idx_supervision_settings_org", columnList = "organization_id")
}, uniqueConstraints = {
        @UniqueConstraint(columnNames = {"organization_id"})
})
public class SupervisionSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Master : feature constellation activée pour l'org. Défaut OFF. */
    @Column(nullable = false)
    private boolean enabled = false;

    /** Pause globale (le runtime autonome n'agit plus). */
    @Column(nullable = false)
    private boolean paused = false;

    /** Plafond : nb max de scans automatiques / jour / org (0 = auto désactivé). */
    @Column(name = "daily_scan_budget", nullable = false)
    private int dailyScanBudget = 20;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public SupervisionSettings() {}

    public SupervisionSettings(Long organizationId) {
        this.organizationId = organizationId;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public boolean isPaused() { return paused; }
    public void setPaused(boolean paused) { this.paused = paused; }

    public int getDailyScanBudget() { return dailyScanBudget; }
    public void setDailyScanBudget(int dailyScanBudget) { this.dailyScanBudget = dailyScanBudget; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
