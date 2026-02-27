-- V66 : Guide numerique d'accueil

CREATE TABLE welcome_guides (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id     BIGINT NOT NULL,
    language        VARCHAR(5) NOT NULL DEFAULT 'fr',
    title           VARCHAR(500) NOT NULL,
    sections        JSONB NOT NULL DEFAULT '[]',
    branding_color  VARCHAR(7) DEFAULT '#2563EB',
    logo_url        VARCHAR(1000),
    published       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_wg_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_wg_property FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX idx_wg_org ON welcome_guides(organization_id);
CREATE INDEX idx_wg_property ON welcome_guides(property_id);
CREATE UNIQUE INDEX idx_wg_property_lang ON welcome_guides(property_id, language);

CREATE TABLE welcome_guide_tokens (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    guide_id        BIGINT NOT NULL,
    reservation_id  BIGINT,
    token           UUID NOT NULL DEFAULT gen_random_uuid(),
    expires_at      TIMESTAMP NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_wgt_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_wgt_guide FOREIGN KEY (guide_id) REFERENCES welcome_guides(id) ON DELETE CASCADE,
    CONSTRAINT fk_wgt_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE UNIQUE INDEX idx_wgt_token ON welcome_guide_tokens(token);
CREATE INDEX idx_wgt_guide ON welcome_guide_tokens(guide_id);
