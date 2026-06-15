package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Vue de rapport personnalisée et sauvegardée, org-scopée (CLZ-P0-15).
 *
 * Les dimensions/métriques sont stockées en codes de la whitelist
 * ({@code ReportFieldCatalog}) séparés par virgule — pas de SQL brut utilisateur.
 * {@code filtersJson} (optionnel) est un JSON appliqué à l'exécution (à venir).
 */
@Entity
@Table(name = "report_views", indexes = {
    @Index(name = "idx_report_view_org", columnList = "organization_id")
})
public class ReportView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotBlank
    @Size(max = 120)
    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Size(max = 64)
    @Column(name = "owner_keycloak_id", length = 64)
    private String ownerKeycloakId;

    /** Codes dimensions whitelistés, séparés par virgule (ex. "PROPERTY,COUNTRY"). */
    @NotBlank
    @Size(max = 255)
    @Column(name = "dimensions", nullable = false, length = 255)
    private String dimensions;

    /** Codes métriques whitelistés, séparés par virgule (ex. "REVENUE,OCCUPANCY"). */
    @NotBlank
    @Size(max = 255)
    @Column(name = "metrics", nullable = false, length = 255)
    private String metrics;

    /** JSON de filtres, appliqué à l'exécution (optionnel). */
    @Column(name = "filters_json", columnDefinition = "text")
    private String filtersJson;

    @NotBlank
    @Size(max = 16)
    @Column(name = "granularity", nullable = false, length = 16)
    private String granularity = "MONTH";

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public ReportView() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getOwnerKeycloakId() { return ownerKeycloakId; }
    public void setOwnerKeycloakId(String ownerKeycloakId) { this.ownerKeycloakId = ownerKeycloakId; }

    public String getDimensions() { return dimensions; }
    public void setDimensions(String dimensions) { this.dimensions = dimensions; }

    public String getMetrics() { return metrics; }
    public void setMetrics(String metrics) { this.metrics = metrics; }

    public String getFiltersJson() { return filtersJson; }
    public void setFiltersJson(String filtersJson) { this.filtersJson = filtersJson; }

    public String getGranularity() { return granularity; }
    public void setGranularity(String granularity) { this.granularity = granularity; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
