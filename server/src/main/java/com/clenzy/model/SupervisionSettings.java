package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Réglage org-level de la constellation Superviseur d'agents (master).
 *
 * <p>Une ligne par organisation. {@code enabled} = interrupteur global de
 * l'<b>observation</b> : les agents passent les logements en revue et proposent
 * des cartes. <b>Activé par défaut</b>, y compris pour une organisation sans
 * ligne — une org qui n'a jamais ouvert le panneau ne renonce pas pour autant à
 * savoir qu'une mission attend confirmation. L'opt-out reste explicite
 * (Paramètres › IA).</p>
 *
 * <p>Ce défaut ne vaut QUE pour l'observation. <b>Agir seul</b> reste un opt-in
 * explicite : {@code AutoApplyGate} exige une ligne, une règle d'automatisation
 * activée et un niveau d'autonomie — voir son étape 1.</p>
 *
 * <p>La config par module vit dans {@link SupervisionModuleSettings}.</p>
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

    /** Master : observation de la constellation activée pour l'org. Défaut ON. */
    @Column(nullable = false)
    private boolean enabled = true;

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
