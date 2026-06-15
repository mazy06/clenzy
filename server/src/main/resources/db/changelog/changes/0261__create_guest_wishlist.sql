-- Comptes voyageur (2.11) Phase 1 : wishlist (favoris) du guest, scopée par (guest Keycloak, org).

CREATE TABLE guest_wishlist_items (
    id              BIGSERIAL PRIMARY KEY,
    keycloak_id     VARCHAR(64) NOT NULL,
    organization_id BIGINT NOT NULL,
    property_id     BIGINT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_guest_wishlist UNIQUE (keycloak_id, organization_id, property_id)
);

CREATE INDEX idx_guest_wishlist_guest ON guest_wishlist_items (keycloak_id, organization_id);
