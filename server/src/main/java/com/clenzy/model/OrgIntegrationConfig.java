package com.clenzy.model;

import com.clenzy.service.signature.SignatureProviderType;
import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.Instant;

/**
 * Configuration des integrations actives par organisation.
 *
 * Stocke le CHOIX du provider pour chaque type de service (signature, et
 * plus tard : facturation client, facturation fournisseur, comptabilite
 * generale, etc.). Le choix est independant des credentials :
 *   - L'org choisit "Odoo" pour la signature → ce row est cree avec
 *     signatureProvider=ODOO.
 *   - Puis l'org va dans Odoo card et saisit ses credentials → cree un
 *     OdooConnection separe.
 *   - Si l'org repasse le choix sur "Pennylane", on garde la OdooConnection
 *     (elle pourra etre reutilisee plus tard) mais le SignatureProviderRegistry
 *     route vers Pennylane.
 *
 * Une seule row par organisation (orgId est unique).
 */
@Entity
@Table(name = "org_integration_config",
    indexes = @Index(name = "idx_org_integration_config_org", columnList = "organization_id", unique = true))
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class OrgIntegrationConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false, unique = true)
    private Long organizationId;

    /**
     * Provider actif pour la signature electronique.
     * NULL = pas de provider choisi → signature electronique desactivee
     * pour cette organisation.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "signature_provider", length = 30)
    private SignatureProviderType signatureProvider;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // Getters / Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public SignatureProviderType getSignatureProvider() { return signatureProvider; }
    public void setSignatureProvider(SignatureProviderType signatureProvider) { this.signatureProvider = signatureProvider; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
