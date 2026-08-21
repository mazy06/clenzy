-- Equipe PERSONNELLE d'un intervenant — « equipe implicite » d'une personne.
--
-- Le moteur d'affectation (PropertyTeamService) ne connait que les equipes :
-- les zones de couverture sont clefees par team_id, l'occupation se teste par
-- team_id, la compatibilite de metier vient du interventionType de l'equipe. Un
-- intervenant sans equipe est donc INVISIBLE de l'auto-assignation, meme si le
-- modele Intervention sait l'assigner directement (assignedToType = 'user').
--
-- Plutot que de dupliquer tout le moteur pour les personnes, on rattache chaque
-- intervenant independant a une equipe d'un seul membre. Zones, disponibilites
-- et compatibilite fonctionnent alors sans modification.
--
-- `personal_user_id` porte le marqueur ET l'identite : savoir QUI l'equipe
-- represente permet de la retrouver, de l'exclure des listes d'equipes de
-- l'interface gestionnaire, et d'empecher les doublons.

ALTER TABLE teams ADD COLUMN IF NOT EXISTS personal_user_id BIGINT;

-- Une seule equipe personnelle par (organisation, intervenant). Index UNIQUE
-- PARTIEL : les equipes classiques ont personal_user_id NULL et ne sont pas
-- concernees par la contrainte.
CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_personal_user
    ON teams (organization_id, personal_user_id)
    WHERE personal_user_id IS NOT NULL;

COMMENT ON COLUMN teams.personal_user_id IS
    'Intervenant represente par cette equipe d''une personne (NULL = equipe classique).';
