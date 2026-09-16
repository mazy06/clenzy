-- Baitly : la file de réveils ne doit ni gonfler à chaque transition, ni conserver l'historique.
--
-- Le déclencheur d'origine suffixait chaque clé d'un UUID, donc une rafale de
-- transitions sur un même besoin créait autant de tâches que d'écritures — et
-- autant de lignes d'outbox et de messages Kafka. Une tâche REFRESH ou TICK déjà
-- en attente couvre la suivante : elle relit l'état courant au moment où elle
-- s'exécute. L'UUID reste, pour ne jamais entrer en collision avec une clé
-- historique déjà consommée.
CREATE OR REPLACE FUNCTION baitly_assignment_request_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.assignment_phase,NEW.assignment_cycle,NEW.status,NEW.converted_intervention_id)
   IS NOT DISTINCT FROM ROW(OLD.assignment_phase,OLD.assignment_cycle,OLD.status,OLD.converted_intervention_id) THEN
   RETURN NEW;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM baitly_assignment_jobs
     WHERE request_id=NEW.id AND kind='REFRESH' AND completed_at IS NULL) THEN
  INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at)
  VALUES ('refresh:'||NEW.id||':'||gen_random_uuid(),NEW.id,'REFRESH',CURRENT_TIMESTAMP);
 END IF;
 IF NEW.status='PENDING' AND (NEW.assignment_phase IS NULL OR NEW.assignment_phase='INTERNAL')
   AND NEW.marketplace_request_id IS NULL AND NEW.converted_intervention_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM baitly_assignment_jobs
     WHERE request_id=NEW.id AND kind='TICK' AND completed_at IS NULL AND due_at<=CURRENT_TIMESTAMP) THEN
  INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at)
  VALUES ('search:'||NEW.id||':'||gen_random_uuid(),NEW.id,'TICK',CURRENT_TIMESTAMP);
 END IF;
 RETURN NEW;
END $$;

-- Lecture de la purge : les tâches terminées ne sont plus jamais relues par
-- l'index partiel, mais elles occupent la table. Index dédié pour purger sans
-- balayage complet.
CREATE INDEX IF NOT EXISTS baitly_assignment_jobs_completed ON baitly_assignment_jobs(completed_at) WHERE completed_at IS NOT NULL;
