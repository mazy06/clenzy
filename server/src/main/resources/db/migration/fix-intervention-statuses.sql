-- Script de correction immédiate des statuts d'intervention
-- À exécuter directement dans la base de données PostgreSQL

-- 1. Mettre à jour les statuts SCHEDULED vers PENDING
UPDATE interventions 
SET status = 'PENDING' 
WHERE status = 'SCHEDULED';

-- 2. Vérifier les statuts restants
SELECT DISTINCT status FROM interventions;

-- 3. Vérifier le nombre d'interventions mises à jour
SELECT COUNT(*) as interventions_updated 
FROM interventions 
WHERE status = 'PENDING';

-- 4. Vérifier qu'il n'y a plus de statuts invalides
SELECT COUNT(*) as invalid_statuses
FROM interventions 
WHERE status NOT IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
