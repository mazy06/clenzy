-- Une intervention n'a pas toujours de demande de service a l'origine.
--
-- Le schema imposait `service_request_id NOT NULL` : toute intervention devait
-- naitre d'une DEMANDE. C'est vrai du flux humain — un proprietaire ou un
-- voyageur demande, on planifie — mais faux du flux AGENT : une batterie de
-- serrure a 12 %, un entretien preventif en retard de onze mois, une escalade
-- de bruit. Personne n'a rien demande ; l'agent a constate.
--
-- Consequence : `CreateMaintenanceInterventionExecutor` n'a JAMAIS pu inserer.
-- Ni depuis la carte de constellation, ni depuis l'AutomationRule F7a. Le code
-- existait, ses tests passaient (le schema Hibernate des tests ne porte pas la
-- contrainte), et l'echec ne se produisait qu'a l'insertion reelle.
--
-- Aucune ligne existante n'est concernee : elles ont toutes une demande.
ALTER TABLE interventions
    ALTER COLUMN service_request_id DROP NOT NULL;

COMMENT ON COLUMN interventions.service_request_id IS
    'Demande de service a l''origine, quand il y en a une. NULL pour les '
    'interventions creees par un agent sur constat (batterie, entretien '
    'preventif, escalade bruit) : personne ne les a demandees.';
