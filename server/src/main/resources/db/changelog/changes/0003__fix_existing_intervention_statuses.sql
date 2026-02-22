-- Migration V3: Correction des statuts existants des interventions
-- Mettre à jour les statuts SCHEDULED vers PENDING (équivalent le plus proche)

UPDATE interventions 
SET status = 'PENDING' 
WHERE status = 'SCHEDULED';

-- Vérifier qu'il n'y a plus de statuts invalides
-- Les seuls statuts autorisés sont maintenant : PENDING, IN_PROGRESS, COMPLETED, CANCELLED

-- Log des mises à jour effectuées
DO $$
BEGIN
    RAISE NOTICE 'Migration V3 terminée : Statuts SCHEDULED convertis en PENDING';
END $$;
