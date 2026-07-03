package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Lien public de la Constellation Proprietaire (campagne X9 v1) : la
 * conciergerie genere un lien en LECTURE SEULE qu'elle partage a son
 * proprietaire — ce que les agents ont fait pour SES biens + son relevé.
 * Pattern {@link WelcomeGuideToken} : UUID non enumerable, expiration,
 * revocable.
 */
@Entity
@Table(name = "owner_portal_token")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class OwnerPortalToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Proprietaire (User.id) destinataire du lien. */
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false, unique = true)
    private UUID token = UUID.randomUUID();

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private boolean revoked = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public OwnerPortalToken() {}

    public OwnerPortalToken(Long organizationId, Long ownerId, LocalDateTime expiresAt) {
        this.organizationId = organizationId;
        this.ownerId = ownerId;
        this.expiresAt = expiresAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public UUID getToken() { return token; }
    public void setToken(UUID token) { this.token = token; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public boolean isRevoked() { return revoked; }
    public void setRevoked(boolean revoked) { this.revoked = revoked; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    /** Validite a l'instant present : non revoque et non expire. */
    public boolean isCurrentlyValid() {
        return !revoked && expiresAt != null && expiresAt.isAfter(LocalDateTime.now());
    }
}
