-- Baitly : capacités explicites, indépendantes des rôles de connexion.
-- Tables vérifiées : Team -> teams, PropertyTeam -> property_teams,
-- catalogue 0420 -> marketplace_service_items(code).
CREATE TABLE team_service_capabilities (
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    service_item_code VARCHAR(60) NOT NULL REFERENCES marketplace_service_items(code),
    PRIMARY KEY(team_id, service_item_code)
);
CREATE INDEX idx_team_capability_service ON team_service_capabilities(service_item_code,team_id);

-- Un groupe historique ne prouve pas les compétences de ses membres.
-- Seul le ménage courant des équipes explicitement dédiées est non ambigu.
INSERT INTO team_service_capabilities(team_id,service_item_code)
SELECT id,'cleaning-turnover' FROM teams
WHERE intervention_type='CLEANING' AND personal_user_id IS NULL;

ALTER TABLE property_teams ADD COLUMN service_item_code VARCHAR(60)
    REFERENCES marketplace_service_items(code);
ALTER TABLE property_teams ADD COLUMN priority INTEGER NOT NULL DEFAULT 100 CHECK(priority>=0);
ALTER TABLE property_teams ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE property_teams DROP CONSTRAINT IF EXISTS property_teams_property_id_key;
UPDATE property_teams pt SET service_item_code='cleaning-turnover'
WHERE EXISTS(SELECT 1 FROM team_service_capabilities c WHERE c.team_id=pt.team_id AND c.service_item_code='cleaning-turnover');
-- Les liens anciens non qualifiés sont conservés et ne sont pas des candidats implicites.
UPDATE property_teams SET active=false WHERE service_item_code IS NULL;
CREATE UNIQUE INDEX uq_property_team_service ON property_teams(organization_id,property_id,service_item_code,team_id)
    WHERE service_item_code IS NOT NULL;
CREATE INDEX idx_property_team_service_candidates ON property_teams(organization_id,property_id,service_item_code,priority,id)
    WHERE active;
