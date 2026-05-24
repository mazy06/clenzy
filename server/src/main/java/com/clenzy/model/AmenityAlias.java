package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Mapping entre un nom d'amenity OTA brut (ex Airbnb "Smoke alarm") et un
 * code Clenzy (built-in comme WIFI, ou custom comme SMOKE_ALARM).
 *
 * <p>Un alias est defini au niveau organisation et applique a l'import et
 * au re-traitement des properties. Si une property contient
 * {@code ota_raw_amenities = ["Smoke alarm"]} et qu'un alias existe pour
 * "Smoke alarm" → SMOKE_ALARM, alors :
 * <ul>
 *   <li>SMOKE_ALARM est ajoute a {@code properties.amenities}</li>
 *   <li>"Smoke alarm" est retire de {@code properties.ota_raw_amenities}</li>
 * </ul></p>
 */
@Entity
@Table(name = "amenity_aliases",
       uniqueConstraints = @UniqueConstraint(name = "amenity_aliases_org_raw_unique",
                                              columnNames = {"organization_id", "raw_ota_name"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class AmenityAlias {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Nom exact tel que renvoye par l'OTA (ex "Smoke alarm"). */
    @Column(name = "raw_ota_name", nullable = false, length = 200)
    private String rawOtaName;

    /** Code Clenzy cible : built-in (WIFI, TV, ...) ou custom_amenities.code. */
    @Column(name = "clenzy_code", nullable = false, length = 80)
    private String clenzyCode;

    /** Source OTA : "AirBNB", "BookingCom", "VrboCom", ... ou null. */
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

    public String getClenzyCode() { return clenzyCode; }
    public void setClenzyCode(String clenzyCode) { this.clenzyCode = clenzyCode; }

    public String getOtaSource() { return otaSource; }
    public void setOtaSource(String otaSource) { this.otaSource = otaSource; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
}
