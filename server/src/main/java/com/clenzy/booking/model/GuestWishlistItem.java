package com.clenzy.booking.model;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Favori (wishlist) d'un voyageur (compte guest 2.11). Scopé par (guest Keycloak, organisation) :
 * un même guest a une wishlist distincte par org du booking engine. Identité guest validée via le
 * token Keycloak (realm clenzy-guests) côté service.
 */
@Entity
@Table(name = "guest_wishlist_items",
    uniqueConstraints = @UniqueConstraint(name = "uq_guest_wishlist", columnNames = {"keycloak_id", "organization_id", "property_id"}),
    indexes = @Index(name = "idx_guest_wishlist_guest", columnList = "keycloak_id, organization_id"))
public class GuestWishlistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "keycloak_id", nullable = false, length = 64)
    private String keycloakId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getKeycloakId() { return keycloakId; }
    public void setKeycloakId(String keycloakId) { this.keycloakId = keycloakId; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
