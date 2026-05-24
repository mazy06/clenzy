package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Nom d'amenity OTA brut explicitement marque "a ignorer".
 *
 * <p>Quand l'admin clique sur "Ignorer" pour un nom comme "Long term stays
 * allowed", celui-ci est ajoute ici. Il :
 * <ul>
 *   <li>n'apparait plus dans la liste "A mapper" cote UI</li>
 *   <li>est retire de {@code properties.ota_raw_amenities} au prochain reprocess</li>
 *   <li>est ignore lors des futurs imports</li>
 * </ul></p>
 *
 * <p>L'admin peut le "reintroduire" via la liste des ignored.</p>
 */
@Entity
@Table(name = "ignored_amenities",
       uniqueConstraints = @UniqueConstraint(name = "ignored_amenities_org_raw_unique",
                                              columnNames = {"organization_id", "raw_ota_name"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class IgnoredAmenity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "raw_ota_name", nullable = false, length = 200)
    private String rawOtaName;

    @Column(name = "ota_source", length = 40)
    private String otaSource;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;

    // ─── Getters / Setters ──────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getRawOtaName() { return rawOtaName; }
    public void setRawOtaName(String rawOtaName) { this.rawOtaName = rawOtaName; }

    public String getOtaSource() { return otaSource; }
    public void setOtaSource(String otaSource) { this.otaSource = otaSource; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
}
