-- Config org-level de la constellation Superviseur d'agents IA.
-- supervision_settings : master (enabled/paused) par organisation.
-- supervision_module_settings : enabled + autonomie par (org, module).
-- Catalogue extensible : module référencé par module_key (string), pas un enum figé.

CREATE TABLE IF NOT EXISTS supervision_settings (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT  NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    paused          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP NOT NULL,
    CONSTRAINT uq_supervision_settings_org UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_supervision_settings_org
    ON supervision_settings (organization_id);

CREATE TABLE IF NOT EXISTS supervision_module_settings (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT      NOT NULL,
    module_key      VARCHAR(40) NOT NULL,
    enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
    autonomy_level  VARCHAR(20) NOT NULL DEFAULT 'SUGGEST',
    created_at      TIMESTAMP   NOT NULL,
    updated_at      TIMESTAMP   NOT NULL,
    CONSTRAINT uq_supervision_module_settings_org_key UNIQUE (organization_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_supervision_module_settings_org
    ON supervision_module_settings (organization_id);
