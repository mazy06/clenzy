-- V46 : Ajouter les nouveaux roles LAUNDRY et EXTERIOR_TECH a la contrainte CHECK de portfolio_teams
-- Les roles d'equipe ont ete elargis pour inclure les roles operationnels LAUNDRY et EXTERIOR_TECH.

-- Supprimer l'ancienne contrainte
ALTER TABLE portfolio_teams DROP CONSTRAINT IF EXISTS chk_role_in_team_valid;

-- Recreer avec les nouveaux roles
ALTER TABLE portfolio_teams ADD CONSTRAINT chk_role_in_team_valid
    CHECK (role_in_team IN ('TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR', 'LAUNDRY', 'EXTERIOR_TECH', 'LEADER'));
