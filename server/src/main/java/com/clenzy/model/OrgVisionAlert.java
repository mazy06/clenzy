package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;

/**
 * Configuration des alertes admin quand l'usage vision (tokens prompt sur
 * messages avec attachments) depasse un seuil mensuel.
 *
 * <p>Une ligne par org_id (UNIQUE) — opt-in explicite : si pas de ligne, aucune
 * alerte n'est jamais envoyee pour cette org.</p>
 */
@Entity
@Table(name = "org_vision_alerts")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class OrgVisionAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false, unique = true)
    private Long organizationId;

    /** Seuil mensuel (30j glissants) de tokens — ex: 5_000_000. */
    @Column(name = "threshold_tokens", nullable = false)
    private long thresholdTokens;

    @Column(name = "last_alerted_at")
    private LocalDateTime lastAlertedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public OrgVisionAlert() {}

    public OrgVisionAlert(Long organizationId, long thresholdTokens) {
        this.organizationId = organizationId;
        this.thresholdTokens = thresholdTokens;
    }

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public long getThresholdTokens() { return thresholdTokens; }
    public void setThresholdTokens(long thresholdTokens) { this.thresholdTokens = thresholdTokens; }
    public LocalDateTime getLastAlertedAt() { return lastAlertedAt; }
    public void setLastAlertedAt(LocalDateTime lastAlertedAt) { this.lastAlertedAt = lastAlertedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
