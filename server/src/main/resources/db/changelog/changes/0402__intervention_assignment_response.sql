-- Reponse de l'intervenant a une mission qui lui est assignee.
--
-- NULL = aucune reponse attendue : c'est l'etat de toutes les interventions
-- existantes, et elles restent exploitables sans migration de donnees. Seules
-- les assignations posterieures naissent en 'PENDING'.
ALTER TABLE interventions
    ADD COLUMN IF NOT EXISTS assignment_response VARCHAR(20),
    ADD COLUMN IF NOT EXISTS assignment_responded_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS assignment_decline_reason TEXT;

-- Index partiel : la seule lecture chaude est « mes missions a confirmer ».
-- Les lignes acceptees ou refusees n'ont pas a peser dans cet index.
CREATE INDEX IF NOT EXISTS idx_interventions_assignment_pending
    ON interventions (assigned_technician_id, team_id)
    WHERE assignment_response = 'PENDING';
