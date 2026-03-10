-- V100: Amélioration du système d'auto-assignation
-- - Champs retry/status sur service_requests
-- - Table audit des assignations
-- - Table paramètres workflow par organisation

-- 1) Champs retry sur service_requests
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS auto_assign_retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_auto_assign_attempt TIMESTAMP,
  ADD COLUMN IF NOT EXISTS auto_assign_status VARCHAR(20) DEFAULT NULL;

-- 2) Journal d'assignation (append-only)
CREATE TABLE IF NOT EXISTS assignment_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  service_request_id BIGINT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL,
  team_id BIGINT,
  assigned_to_type VARCHAR(10),
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignment_events_sr ON assignment_events(service_request_id);

-- 3) Paramètres workflow par organisation
CREATE TABLE IF NOT EXISTS workflow_settings (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL UNIQUE,
  auto_assign_interventions BOOLEAN NOT NULL DEFAULT true,
  cancellation_deadline_hours INTEGER NOT NULL DEFAULT 24,
  require_approval_for_changes BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
