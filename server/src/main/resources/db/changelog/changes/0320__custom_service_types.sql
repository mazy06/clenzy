-- 0320 : Types de service personnalisés (« Autre »), réutilisables et org-scopés.
-- Quand un opérateur saisit un type de service hors liste, il est enregistré ici
-- pour réapparaître comme chip sélectionnable. category = cleaning|maintenance|other.
CREATE TABLE IF NOT EXISTS custom_service_types (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    category VARCHAR(20) NOT NULL,
    label VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_custom_service_type UNIQUE (organization_id, category, label)
);
CREATE INDEX IF NOT EXISTS idx_custom_service_type_org_cat
    ON custom_service_types (organization_id, category);
