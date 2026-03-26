-- Booking guest profiles: stores guest data linked to Keycloak (clenzy-guests realm).
-- One Keycloak account per email, but one profile per (keycloak_id, organization_id).

CREATE TABLE booking_guest_profiles (
    id              BIGSERIAL PRIMARY KEY,
    keycloak_id     VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    phone           VARCHAR(30),
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMP,
    UNIQUE(keycloak_id, organization_id)
);

CREATE INDEX idx_booking_guest_profiles_email_org ON booking_guest_profiles(email, organization_id);
CREATE INDEX idx_booking_guest_profiles_keycloak_id ON booking_guest_profiles(keycloak_id);
CREATE INDEX idx_booking_guest_profiles_org ON booking_guest_profiles(organization_id);
