-- ============================================================================
-- 0311 : Taxe de séjour v2 — barème par défaut d'organisation + plafond + surtaxes
-- ============================================================================
-- La table tourist_tax_configs existe déjà (baseline 0000, une config par
-- propriété). Ce changeset étend le modèle pour les conciergeries françaises :
--   - property_id devient NULLABLE : NULL = barème PAR DÉFAUT de l'org,
--     sinon override par bien (résolution : override > défaut org).
--   - cap_per_person_night : plafond €/personne/nuit pour le mode
--     PERCENTAGE_OF_RATE (hébergement non classé « au réel » : % du prix de
--     la nuitée par personne, plafonné).
--   - departmental_surcharge_pct : taxe additionnelle départementale (%,
--     typiquement 10). NULL = 0.
--   - regional_surcharge_pct : taxe additionnelle régionale (%). NULL = 0.
--   - exempt_minors : exonération légale des mineurs (<18 ans). v1 : sans
--     effet de calcul tant que les réservations ne portent que guest_count
--     (pas de ventilation adultes/enfants) — champ posé pour la suite.
-- Dédoublonnage + index uniques partiels : ferme le check-then-act de
-- l'upsert (une seule config par (org, propriété) et un seul défaut par org).
-- Idempotent (IF NOT EXISTS / IF EXISTS) pour cohabiter avec le schéma
-- Hibernate ddl-auto des environnements de dev.
-- ============================================================================

ALTER TABLE tourist_tax_configs ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE tourist_tax_configs ADD COLUMN IF NOT EXISTS cap_per_person_night NUMERIC(6,2);
ALTER TABLE tourist_tax_configs ADD COLUMN IF NOT EXISTS departmental_surcharge_pct NUMERIC(6,2);
ALTER TABLE tourist_tax_configs ADD COLUMN IF NOT EXISTS regional_surcharge_pct NUMERIC(6,2);
ALTER TABLE tourist_tax_configs ADD COLUMN IF NOT EXISTS exempt_minors BOOLEAN NOT NULL DEFAULT TRUE;

-- Dédoublonnage défensif avant pose des index uniques (garde la ligne la plus
-- récente par (org, propriété) — property_id est encore NOT NULL partout à ce
-- stade, les lignes NULL n'existent pas encore).
DELETE FROM tourist_tax_configs t
USING tourist_tax_configs d
WHERE t.organization_id = d.organization_id
  AND t.property_id = d.property_id
  AND t.id < d.id;

CREATE INDEX IF NOT EXISTS idx_tourist_tax_configs_org
    ON tourist_tax_configs (organization_id);

-- Une seule config par (org, propriété)…
CREATE UNIQUE INDEX IF NOT EXISTS ux_tourist_tax_org_property
    ON tourist_tax_configs (organization_id, property_id)
    WHERE property_id IS NOT NULL;

-- …et un seul barème par défaut par org.
CREATE UNIQUE INDEX IF NOT EXISTS ux_tourist_tax_org_default
    ON tourist_tax_configs (organization_id)
    WHERE property_id IS NULL;
