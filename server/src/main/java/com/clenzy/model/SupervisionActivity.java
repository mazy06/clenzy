package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Une entrée du journal d'activité de la constellation Superviseur.
 *
 * <p>Org/property-scopée. Produite quand un module (agent) agit — d'abord
 * pendant un chat opérateur (pont AG-UI), puis par la boucle de scan autonome
 * (Phase 3-B.2). Alimente le feed « en direct » et le compteur d'actions.</p>
 *
 * <p>{@code kind} : {@code ACT} (a agi) ou {@code SUGGEST} (a proposé). Stocké en
 * String — pas un enum figé — pour rester extensible sans migration.</p>
 */
@Entity
@Table(name = "supervision_activity", indexes = {
        @Index(name = "idx_supervision_activity_org_prop_created",
                columnList = "organization_id, property_id, created_at")
})
public class SupervisionActivity {

    public static final String KIND_ACT = "ACT";
    public static final String KIND_SUGGEST = "SUGGEST";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    /** Module/agent concerné (ex. {@code com}), cf. SupervisionModuleRegistry. */
    @Column(name = "module_key", nullable = false, length = 40)
    private String moduleKey;

    @Column(nullable = false, length = 20)
    private String kind = KIND_ACT;

    @Column(name = "tool_name", length = 120)
    private String toolName;

    @Column(length = 500)
    private String summary;

    @Column(name = "reservation_id")
    private Long reservationId;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private Instant createdAt;

    public SupervisionActivity() {}

    public SupervisionActivity(Long organizationId, Long propertyId, String moduleKey,
                               String kind, String toolName, String summary) {
        this.organizationId = organizationId;
        this.propertyId = propertyId;
        this.moduleKey = moduleKey;
        this.kind = kind;
        this.toolName = toolName;
        this.summary = summary;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getModuleKey() { return moduleKey; }
    public void setModuleKey(String moduleKey) { this.moduleKey = moduleKey; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public String getToolName() { return toolName; }
    public void setToolName(String toolName) { this.toolName = toolName; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public Instant getCreatedAt() { return createdAt; }
}
