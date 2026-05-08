-- Purge complete des donnees d'equipes pour reset apres l'incident sur la
-- migration 0109 (schema team_coverage_zones potentiellement incoherent).
-- L'utilisateur recreera une equipe fraiche depuis l'UI une fois deploye.
--
-- Ordre : on vide d'abord toutes les tables qui referencent teams (FK), puis
-- on detache les service_requests assignees a une team (sinon FK violation),
-- puis on vide teams.

DELETE FROM team_coverage_zones;

DELETE FROM property_teams;

DELETE FROM team_members;

DELETE FROM manager_teams;

UPDATE service_requests
SET assigned_to_id = NULL,
    assigned_to_type = NULL,
    auto_assign_status = NULL,
    auto_assign_retry_count = 0,
    last_auto_assign_attempt = NULL,
    status = CASE WHEN status = 'AWAITING_PAYMENT' THEN 'PENDING' ELSE status END
WHERE assigned_to_type = 'team';

DELETE FROM teams;
