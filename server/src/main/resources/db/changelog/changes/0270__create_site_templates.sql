-- Catalogue de templates de site hébergé (galerie « Choisir un design » du Studio).
-- organization_id NULL  = catalogue GLOBAL Clenzy (curé par le staff plateforme, visible par tous les orgs) ;
-- organization_id défini = template PRIVÉ à l'organisation.
-- content_json = le template.json complet (thème + pages + customCss/Js) appliqué via le flux d'import.
CREATE TABLE site_templates (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT,
    name            VARCHAR(120) NOT NULL,
    description     VARCHAR(500),
    register        VARCHAR(20) DEFAULT 'product',
    preview_url     VARCHAR(500),
    content_json    TEXT NOT NULL,
    created_by      VARCHAR(64),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_site_templates_org ON site_templates (organization_id);
