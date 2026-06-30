package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Config org-level d'UN module (agent) de la constellation.
 *
 * <p>Le module est référencé par {@code moduleKey} (string) — pas un enum figé —
 * pour rester extensible : un module ajouté au catalogue (built-in ou importé)
 * slotte sans changement de schéma. Une ligne par (org, module).</p>
 */
@Entity
@Table(name = "supervision_module_settings", indexes = {
        @Index(name = "idx_supervision_module_settings_org", columnList = "organization_id")
}, uniqueConstraints = {
        @UniqueConstraint(columnNames = {"organization_id", "module_key"})
})
public class SupervisionModuleSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Clé du module (ex. {@code com}, {@code rev}…), cf. SupervisionModuleRegistry. */
    @Column(name = "module_key", nullable = false, length = 40)
    private String moduleKey;

    @Column(nullable = false)
    private boolean enabled = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "autonomy_level", nullable = false, length = 20)
    private SupervisionAutonomy autonomyLevel = SupervisionAutonomy.SUGGEST;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public SupervisionModuleSettings() {}

    public SupervisionModuleSettings(Long organizationId, String moduleKey,
                                     boolean enabled, SupervisionAutonomy autonomyLevel) {
        this.organizationId = organizationId;
        this.moduleKey = moduleKey;
        this.enabled = enabled;
        this.autonomyLevel = autonomyLevel;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getModuleKey() { return moduleKey; }
    public void setModuleKey(String moduleKey) { this.moduleKey = moduleKey; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public SupervisionAutonomy getAutonomyLevel() { return autonomyLevel; }
    public void setAutonomyLevel(SupervisionAutonomy autonomyLevel) { this.autonomyLevel = autonomyLevel; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
