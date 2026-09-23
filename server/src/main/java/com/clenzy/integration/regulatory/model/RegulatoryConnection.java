package com.clenzy.integration.regulatory.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.Filter;

import java.time.Instant;

/**
 * Raccordement d'une organisation a une plateforme de declaration reglementaire.
 *
 * <p>UNE ligne par organisation et par plateforme : l'identifiant d'agence
 * delivre par le ministere couvre toute l'organisation. La licence visee n'est
 * donc pas portee ici — elle est passee appel par appel, depuis le logement
 * concerne, dont la {@code PropertyLicense} de type {@code TOURISM_REGISTRATION}
 * fait foi.</p>
 */
@Entity
@Table(name = "regulatory_connections")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class RegulatoryConnection {

    public enum Status { ACTIVE, ERROR, REVOKED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 30)
    private RegulatoryProviderType provider;

    /** Racine de la passerelle, sans slash final (ex. https://customer-gateway.tourism.sa). */
    @Column(name = "gateway_url", nullable = false, length = 500)
    private String gatewayUrl;

    @Column(name = "facility_id", nullable = false, length = 200)
    private String facilityId;

    /** Chiffre au repos par {@code ApiKeyEncryptionService} — jamais expose. */
    @Column(name = "facility_secret_encrypted", nullable = false, columnDefinition = "TEXT")
    private String facilitySecretEncrypted;

    /**
     * Envoi en mode test plutot qu'en production. La passerelle compte les deux
     * separement ; par defaut on ne declare RIEN en production tant que le
     * raccordement n'a pas ete bascule explicitement.
     */
    @Column(name = "sandbox", nullable = false)
    private boolean sandbox = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.ACTIVE;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "last_tested_at")
    private Instant lastTestedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public RegulatoryProviderType getProvider() { return provider; }
    public void setProvider(RegulatoryProviderType provider) { this.provider = provider; }

    public String getGatewayUrl() { return gatewayUrl; }
    public void setGatewayUrl(String gatewayUrl) { this.gatewayUrl = gatewayUrl; }

    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }

    public String getFacilitySecretEncrypted() { return facilitySecretEncrypted; }
    public void setFacilitySecretEncrypted(String facilitySecretEncrypted) {
        this.facilitySecretEncrypted = facilitySecretEncrypted;
    }

    public boolean isSandbox() { return sandbox; }
    public void setSandbox(boolean sandbox) { this.sandbox = sandbox; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Instant getLastTestedAt() { return lastTestedAt; }
    public void setLastTestedAt(Instant lastTestedAt) { this.lastTestedAt = lastTestedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
