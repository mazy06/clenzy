-- Migration V2: Correction de la contrainte de statut des interventions
-- Supprimer l'ancienne contrainte
ALTER TABLE interventions DROP CONSTRAINT IF EXISTS interventions_status_check;

-- Ajouter la nouvelle contrainte avec les valeurs autorisées
ALTER TABLE interventions ADD CONSTRAINT interventions_status_check 
CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));

-- Mettre à jour les statuts existants qui pourraient être invalides
UPDATE interventions SET status = 'PENDING' WHERE status NOT IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') OR status IS NULL;
