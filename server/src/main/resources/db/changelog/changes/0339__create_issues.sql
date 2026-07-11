-- Moteur Ménage (Phase 3C / P10) — anomalie terrain de premier ordre.
-- Un signalement du terrain (housekeeper/technicien, mobile) devient un ticket
-- « Issue » qualifiable par le gestionnaire puis convertible en demande de
-- maintenance pré-chiffrée (ServiceRequest). Cycle de vie :
-- OPEN → QUALIFIED → CONVERTED | DISMISSED.
CREATE TABLE IF NOT EXISTS issues (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    -- Intervention pendant laquelle l'anomalie a été constatée (NULL si signalement web hors mission).
    source_intervention_id BIGINT,
    -- users.id du signaleur (résolu depuis le JWT).
    reported_by BIGINT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    -- Catégorie libre ou alignée sur le catalogue travaux (interventionType/label/domain).
    category VARCHAR(80),
    severity VARCHAR(10) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'OPEN',
    -- Chiffrage suggéré depuis le catalogue travaux (NULL = chiffrage manuel).
    suggested_cost NUMERIC(10, 2),
    -- ServiceRequest maintenance créée à la conversion.
    converted_service_request_id BIGINT,
    dismiss_reason VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS issues_org_status_idx ON issues (organization_id, status);
CREATE INDEX IF NOT EXISTS issues_property_idx ON issues (property_id);

COMMENT ON TABLE issues IS
    'Anomalies terrain (signalements housekeeper/technicien) convertibles en demandes de maintenance chiffrees. Moteur Menage 3C';
