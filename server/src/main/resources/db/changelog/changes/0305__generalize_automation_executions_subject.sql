-- Campagne Baitly — moteur AutomationRule = registre central des flux deterministes.
-- 1) Generalise automation_executions a un sujet generique (reservation, facture, payout,
--    alerte bruit, device...) : idempotence (regle x subject_type x subject_id).
--    Les lignes historiques sont toutes des reservations → backfill RESERVATION,
--    puis reservation_id devient nullable (sujets non-reservation).
-- 2) Elargit automation_rules.action_type a 40 chars : les nouvelles actions depassent 30
--    (ex. CREATE_MAINTENANCE_INTERVENTION = 31).
-- NB : ces deux tables datent de l'ere Hibernate ddl-auto (absentes du baseline Liquibase,
--      cf. 0274 qui a droppe leurs contraintes CHECK) — ALTER defensifs IF NOT EXISTS.

ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS subject_type VARCHAR(30);
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS subject_id BIGINT;

UPDATE automation_executions
SET subject_type = 'RESERVATION', subject_id = reservation_id
WHERE subject_type IS NULL;

ALTER TABLE automation_executions ALTER COLUMN subject_type SET NOT NULL;
ALTER TABLE automation_executions ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE automation_executions ALTER COLUMN reservation_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_exec_rule_subject
    ON automation_executions (automation_rule_id, subject_type, subject_id);

ALTER TABLE automation_rules ALTER COLUMN action_type TYPE VARCHAR(40);
