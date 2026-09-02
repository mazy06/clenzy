-- Observation de la constellation : ON par defaut.
--
-- Le master supervision naissait a false, et le balayage autonome ne retenait
-- que les orgs explicitement activees. Personne ne l'ayant jamais active, aucun
-- agent ne passait les logements en revue : les seules cartes visibles venaient
-- d'ailleurs (parite tarifaire, bruit, affectation...).
--
-- Le defaut produit devient l'observation. Cela ne rend RIEN automatique :
-- AutoApplyGate exige toujours une ligne, une regle d'automatisation activee et
-- un niveau d'autonomie pour agir seul. Le plafond de scans quotidien
-- (daily_scan_budget) et le plafond de credits premium bornent la depense.
--
-- Les lignes existantes sont alignees une fois : la feature n'ayant jamais
-- tourne, aucune organisation n'a pu choisir de s'en passer en connaissance de
-- cause. L'opt-out reste disponible dans Parametres > IA.

ALTER TABLE supervision_settings ALTER COLUMN enabled SET DEFAULT true;

UPDATE supervision_settings SET enabled = true WHERE enabled = false;
