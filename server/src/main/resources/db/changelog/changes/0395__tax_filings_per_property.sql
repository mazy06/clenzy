-- Ventilation de la taxe de séjour PAR LOGEMENT.
--
-- Une déclaration par organisation et par trimestre était structurellement
-- fausse dès qu'un portefeuille couvre plusieurs communes : on ne dépose pas
-- une déclaration « à l'organisation », on la dépose à CHAQUE commune, avec son
-- barème et son calendrier. La commune est portée par le logement
-- (regulatory_config.city_code), tout comme l'éventuel barème dérogatoire — et
-- désormais le mandat déclaratif (management_contracts.tourist_tax_by). Le
-- logement est donc la seule granularité commune aux trois.
--
-- Les lignes existantes gardent property_id NULL : on ne peut pas les scinder
-- rétroactivement sans tout recalculer. Elles restent lisibles comme un
-- historique « déclaration org, ancien format ».
ALTER TABLE tax_filings
    ADD COLUMN IF NOT EXISTS property_id BIGINT;

-- L'unicité passe de (org, période) à (org, logement, période). L'ancienne
-- contrainte interdisait la ventilation elle-même.
ALTER TABLE tax_filings
    DROP CONSTRAINT IF EXISTS uq_tax_filings_org_period;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_filings_org_property_period
    ON tax_filings (organization_id, property_id, period_start)
    WHERE property_id IS NOT NULL;

-- L'historique org-level reste unique par période, sans bloquer les nouvelles.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_filings_org_legacy_period
    ON tax_filings (organization_id, period_start)
    WHERE property_id IS NULL;
