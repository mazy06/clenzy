-- File différée Baitly : atomique avec les mutations et l'outbox Kafka.
CREATE TABLE baitly_assignment_jobs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_key text NOT NULL UNIQUE,
 request_id bigint NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
 kind varchar(12) NOT NULL CHECK (kind IN ('TICK','NOTIFY','REFRESH')),
 notification_id bigint REFERENCES service_assignment_notifications(id) ON DELETE CASCADE,
 due_at timestamptz NOT NULL,
 completed_at timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 last_error varchar(1000)
);
CREATE INDEX baitly_assignment_jobs_pending ON baitly_assignment_jobs(id) WHERE completed_at IS NULL;

CREATE FUNCTION baitly_assignment_job_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.completed_at IS NULL THEN
  INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,topic,partition_key,payload,organization_id,status,retry_count,created_at)
  SELECT 'ASSIGNMENT',NEW.request_id::text,'ASSIGNMENT_JOB_READY','baitly.assignment.jobs',
    NEW.request_id::text,jsonb_build_object('jobId',NEW.id),r.organization_id,'PENDING',0,CURRENT_TIMESTAMP
  FROM service_requests r WHERE r.id=NEW.request_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER baitly_assignment_job_outbox AFTER INSERT OR UPDATE OF due_at ON baitly_assignment_jobs
 FOR EACH ROW EXECUTE FUNCTION baitly_assignment_job_outbox();

CREATE FUNCTION baitly_assignment_proposal_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='PENDING' THEN
  INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at) VALUES
    ('reminder:'||NEW.id,NEW.request_id,'TICK',NEW.created_at+(NEW.expires_at-NEW.created_at)*0.75),
    ('expiry:'||NEW.id,NEW.request_id,'TICK',NEW.expires_at)
  ON CONFLICT(event_key) DO NOTHING;
 ELSE
  UPDATE baitly_assignment_jobs SET completed_at=CURRENT_TIMESTAMP
   WHERE event_key IN ('reminder:'||NEW.id,'expiry:'||NEW.id) AND completed_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER baitly_assignment_proposal_jobs AFTER INSERT OR UPDATE OF status ON service_assignment_proposals
 FOR EACH ROW EXECUTE FUNCTION baitly_assignment_proposal_jobs();

CREATE FUNCTION baitly_assignment_notification_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,notification_id,due_at)
 VALUES ('notification:'||NEW.id,NEW.request_id,'NOTIFY',NEW.id,NEW.next_attempt_at)
 ON CONFLICT(event_key) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER baitly_assignment_notification_job AFTER INSERT ON service_assignment_notifications
 FOR EACH ROW EXECUTE FUNCTION baitly_assignment_notification_job();

-- Les devis expirent au début du lendemain de valid_until (date métier serveur).
CREATE FUNCTION baitly_assignment_quote_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.assignment_proposal_id IS NOT NULL AND NEW.status IN ('RECEIVED','REJECTED','EXPIRED') THEN
  INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at)
  VALUES ('quote:'||NEW.id||':'||NEW.status||':'||coalesce(NEW.valid_until::text,'none'),NEW.service_request_id,'TICK',
   CASE WHEN NEW.status='RECEIVED' THEN (NEW.valid_until+1)::timestamp AT TIME ZONE 'UTC' ELSE CURRENT_TIMESTAMP END)
  ON CONFLICT(event_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER baitly_assignment_quote_job AFTER INSERT OR UPDATE OF status,valid_until ON service_quotes
 FOR EACH ROW WHEN (NEW.valid_until IS NOT NULL OR NEW.status IN ('REJECTED','EXPIRED'))
 EXECUTE FUNCTION baitly_assignment_quote_job();

-- Réveil à chaque transition métier, jamais à chaque lecture ou passage du temps.
CREATE FUNCTION baitly_assignment_request_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.assignment_phase,NEW.assignment_cycle,NEW.status,NEW.converted_intervention_id)
   IS NOT DISTINCT FROM ROW(OLD.assignment_phase,OLD.assignment_cycle,OLD.status,OLD.converted_intervention_id) THEN
   RETURN NEW;
 END IF;
 INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at)
 VALUES ('refresh:'||NEW.id||':'||gen_random_uuid(),NEW.id,'REFRESH',CURRENT_TIMESTAMP);
 IF NEW.status='PENDING' AND (NEW.assignment_phase IS NULL OR NEW.assignment_phase='INTERNAL')
   AND NEW.marketplace_request_id IS NULL AND NEW.converted_intervention_id IS NULL THEN
  INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at)
  VALUES ('search:'||NEW.id||':'||gen_random_uuid(),NEW.id,'TICK',CURRENT_TIMESTAMP);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER baitly_assignment_request_jobs AFTER INSERT OR UPDATE OF assignment_phase,assignment_cycle,status,converted_intervention_id
 ON service_requests FOR EACH ROW EXECUTE FUNCTION baitly_assignment_request_jobs();

-- Reprise unique des échéances existantes ; aucun scan récurrent des demandes.
INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at)
 SELECT 'expiry:'||id,request_id,'TICK',expires_at FROM service_assignment_proposals WHERE status='PENDING';
INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at)
 SELECT 'reminder:'||id,request_id,'TICK',created_at+(expires_at-created_at)*0.75
 FROM service_assignment_proposals WHERE status='PENDING' AND reminder_at IS NULL;
INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,notification_id,due_at)
 SELECT 'notification:'||id,request_id,'NOTIFY',id,next_attempt_at FROM service_assignment_notifications WHERE sent_at IS NULL;
INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at)
 SELECT 'bootstrap:'||r.id,r.id,'TICK',CURRENT_TIMESTAMP FROM service_requests r
 WHERE (r.assignment_phase IS NULL OR r.assignment_phase='INTERNAL') AND r.status='PENDING'
 AND r.marketplace_request_id IS NULL AND r.converted_intervention_id IS NULL
 AND NOT EXISTS(SELECT 1 FROM interventions i WHERE i.service_request_id=r.id);
INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at)
 SELECT 'quote:'||q.id||':'||q.status||':'||coalesce(q.valid_until::text,'none'),q.service_request_id,'TICK',
 CASE WHEN q.status='RECEIVED' THEN (q.valid_until+1)::timestamp AT TIME ZONE 'UTC' ELSE CURRENT_TIMESTAMP END
 FROM service_quotes q JOIN service_assignment_proposals p ON p.id=q.assignment_proposal_id
 WHERE p.status='QUOTED' AND (q.status IN ('REJECTED','EXPIRED') OR (q.status='RECEIVED' AND q.valid_until IS NOT NULL));
