package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Commodite supplementaire definie au niveau d'une organisation.
 *
 * <p>Etend le referentiel statique Clenzy (AMENITIES_CATEGORIES cote frontend)
 * en permettant a chaque org de creer ses propres codes (ex: SMOKE_ALARM,
 * NESPRESSO_MACHINE, EV_CHARGER...).</p>
 *
 * <p>Le code est unique par organisation. Une fois cree, il peut etre utilise :
 * <ul>
 *   <li>directement dans {@code properties.amenities} (JSON array)</li>
 *   <li>comme cible d'un {@link AmenityAlias}</li>
 * </ul></p>
 */
@Entity
@Table(name = "custom_amenities",
       uniqueConstraints = @UniqueConstraint(name = "custom_amenities_org_code_unique",
                                              columnNames = {"organization_id", "code"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class CustomAmenity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Code unique au format SCREAMING_SNAKE_CASE (ex: SMOKE_ALARM). */
    @Column(name = "code", nullable = false, length = 80)
    private String code;

    /** Label francais (obligatoire — la plateforme est FR-first). */
    @Column(name = "label_fr", nullable = false, length = 120)
    private String labelFr;

    /** Label anglais (optionnel — utilise dans la booking engine multilingue). */
    @Column(name = "label_en", length = 120)
    private String labelEn;

    /**
     * Categorie d'affichage : comfort | kitchen | appliances | outdoor |
     * safetyFamily | custom (par defaut). Doit matcher les categories
     * frontend (cf. AMENITIES_CATEGORIES dans PropertyFormDetails.tsx).
     */
    @Column(name = "category", nullable = false, length = 40)
    private String category = "custom";

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

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getLabelFr() { return labelFr; }
    public void setLabelFr(String labelFr) { this.labelFr = labelFr; }

    public String getLabelEn() { return labelEn; }
    public void setLabelEn(String labelEn) { this.labelEn = labelEn; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
}
