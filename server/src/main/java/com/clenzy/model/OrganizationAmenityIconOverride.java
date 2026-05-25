package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Override par organisation d'une icone d'amenity (built-in ou custom).
 *
 * <p>Le frontend Clenzy associe une icone par defaut a chaque commodite via
 * {@code amenityIcons.ts} (WIFI -> Wifi, POOL -> Waves, etc.). L'admin peut
 * personnaliser ce choix via le picker AmenityIconPicker — la persistance
 * passe par ce mapping (org, code) -> icon_name.</p>
 *
 * <p>Avant cette table, le choix etait conserve en localStorage cote frontend
 * (cle clenzy:amenity-icons:&lt;orgId&gt;), incompatible cross-devices. La
 * migration 0134 introduit cette table pour avoir une source de verite serveur.</p>
 */
@Entity
@Table(
    name = "organization_amenity_icon_overrides",
    uniqueConstraints = @UniqueConstraint(
        name = "amenity_icon_override_org_code_unique",
        columnNames = {"organization_id", "amenity_code"}
    )
)
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class OrganizationAmenityIconOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Code Clenzy de la commodite (WIFI, POOL, ou un custom_amenities.code). */
    @Column(name = "amenity_code", nullable = false, length = 80)
    private String amenityCode;

    /** Nom du composant lucide-react (Wifi, Waves, ChefHat, etc.). */
    @Column(name = "icon_name", nullable = false, length = 80)
    private String iconName;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_user_id")
    private User updatedBy;

    // ─── Getters / Setters ──────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getAmenityCode() { return amenityCode; }
    public void setAmenityCode(String amenityCode) { this.amenityCode = amenityCode; }

    public String getIconName() { return iconName; }
    public void setIconName(String iconName) { this.iconName = iconName; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public User getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(User updatedBy) { this.updatedBy = updatedBy; }
}
