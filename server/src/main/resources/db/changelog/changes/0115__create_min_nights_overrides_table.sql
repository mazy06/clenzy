-- Min-nights overrides per property per date.
-- Permet de definir un minimum de nuits different du defaut de la propriete
-- pour des dates specifiques (week-ends prolonges, evenements, haute saison).
-- Cas d'usage : "minimum 4 nuits a partir du 14 juillet" sans toucher au
-- defaut global de la propriete.

CREATE TABLE IF NOT EXISTS min_nights_overrides (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    min_nights INTEGER NOT NULL CHECK (min_nights >= 1 AND min_nights <= 365),
    source VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_min_nights_overrides_property_date UNIQUE (property_id, date)
);

CREATE INDEX IF NOT EXISTS idx_min_nights_overrides_property_date
    ON min_nights_overrides(property_id, date);

CREATE INDEX IF NOT EXISTS idx_min_nights_overrides_org
    ON min_nights_overrides(organization_id);
