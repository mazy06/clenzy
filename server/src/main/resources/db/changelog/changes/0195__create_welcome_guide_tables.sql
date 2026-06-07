-- ============================================================================
-- 0195 : Livret d'accueil numerique (welcome_guides + welcome_guide_tokens)
-- ============================================================================
-- Le socle WelcomeGuide existait en entites JPA sans changeset Liquibase : en
-- dev les tables ont pu etre auto-creees par Hibernate (ddl-auto=update), en prod
-- (ddl-auto=validate) elles manquaient => feature jamais livrable. Ce changeset
-- formalise le schema. Idempotent (IF NOT EXISTS) pour cohabiter avec une table
-- eventuellement deja auto-creee en dev.
--
-- Le token d'acces guest est borne a la reservation : valid_from = check-in - lead,
-- expires_at = check-out + grace (cf. GuideConfig). `revoked` permet la revocation
-- (annulation de sejour) sans supprimer la ligne (audit).
-- ============================================================================

CREATE TABLE IF NOT EXISTS welcome_guides (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT       NOT NULL,
    property_id     BIGINT       NOT NULL,
    language        VARCHAR(5)   NOT NULL DEFAULT 'fr',
    title           VARCHAR(500) NOT NULL,
    sections        JSONB        NOT NULL DEFAULT '[]',
    branding_color  VARCHAR(7)            DEFAULT '#2563EB',
    logo_url        VARCHAR(1000),
    published       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welcome_guides_org_id      ON welcome_guides (organization_id);
CREATE INDEX IF NOT EXISTS idx_welcome_guides_property_id ON welcome_guides (property_id);

CREATE TABLE IF NOT EXISTS welcome_guide_tokens (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT    NOT NULL,
    guide_id        BIGINT    NOT NULL,
    reservation_id  BIGINT,
    token           UUID      NOT NULL,
    valid_from      TIMESTAMP,
    expires_at      TIMESTAMP NOT NULL,
    revoked         BOOLEAN   NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Colonnes ajoutees au socle existant (no-op si la table vient d'etre creee ci-dessus,
-- ou si Hibernate avait auto-cree la table sans ces colonnes en dev).
ALTER TABLE welcome_guide_tokens ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP;
ALTER TABLE welcome_guide_tokens ADD COLUMN IF NOT EXISTS revoked    BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_welcome_guide_tokens_token ON welcome_guide_tokens (token);
CREATE INDEX IF NOT EXISTS idx_welcome_guide_tokens_guide_id    ON welcome_guide_tokens (guide_id);
CREATE INDEX IF NOT EXISTS idx_welcome_guide_tokens_reservation ON welcome_guide_tokens (reservation_id);
