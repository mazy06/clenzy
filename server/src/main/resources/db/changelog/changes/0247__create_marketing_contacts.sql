-- Capture de leads / email marketing (CLZ Domaine 2). Contacts capturés via le Booking Engine
-- (newsletter, waitlist, exit-intent, panier abandonné), org-scopés, dédupliqués par (org, email),
-- avec consentement RGPD horodaté.

CREATE TABLE marketing_contacts (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    email           VARCHAR(320) NOT NULL,
    name            VARCHAR(200),
    source          VARCHAR(30)  NOT NULL DEFAULT 'OTHER',
    locale          VARCHAR(10),
    status          VARCHAR(20)  NOT NULL DEFAULT 'SUBSCRIBED',
    consent         BOOLEAN      NOT NULL DEFAULT FALSE,
    consent_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

ALTER TABLE marketing_contacts
    ADD CONSTRAINT uq_marketing_contacts_org_email UNIQUE (organization_id, email);

CREATE INDEX idx_marketing_contacts_org ON marketing_contacts (organization_id, created_at DESC);
