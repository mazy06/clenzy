package com.clenzy.marketplace.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Exception a la visibilite par defaut du catalogue.
 *
 * <p>Une fiche sans aucune regle est visible de toutes les organisations des
 * lors que son etat et son mode d'engagement le permettent — c'est le
 * comportement attendu d'une place de marche. Cette table ne porte donc QUE les
 * ecarts a ce defaut.</p>
 *
 * <p><b>Pas de filtre tenant.</b> Comme le reste des tables
 * {@code marketplace_*}, celle-ci est PLATEFORME : une regle nomme une
 * organisation, elle n'appartient pas a une organisation. Y poser le filtre
 * Hibernate empecherait precisement de savoir qui est exclu.</p>
 */
@Entity
@Table(
    name = "marketplace_exposure_rules",
    indexes = {
        @Index(name = "idx_exposure_org", columnList = "organization_id"),
    }
)
public class MarketplaceExposureRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "marketplace_provider_id", nullable = false)
    private Long providerId;

    /** Organisation visee, ou {@code null} pour toutes. */
    @Column(name = "organization_id")
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "effect", nullable = false, length = 10)
    private ExposureEffect effect;

    /**
     * Pourquoi cette regle existe.
     *
     * <p>Une regle sans motif est impossible a reprendre : personne n'ose la
     * retirer, personne ne sait la justifier.</p>
     */
    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "created_by_keycloak_id", length = 64)
    private String createdByKeycloakId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public MarketplaceExposureRule() {}

    /** Vise-t-elle toutes les organisations ? */
    public boolean isGlobal() {
        return organizationId == null;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getProviderId() { return providerId; }
    public void setProviderId(Long providerId) { this.providerId = providerId; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public ExposureEffect getEffect() { return effect; }
    public void setEffect(ExposureEffect effect) { this.effect = effect; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getCreatedByKeycloakId() { return createdByKeycloakId; }
    public void setCreatedByKeycloakId(String id) { this.createdByKeycloakId = id; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
