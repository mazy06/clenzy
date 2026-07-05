-- ============================================================================
-- 0316 : Migration de la messagerie invité check-in/check-out vers le hub
-- ============================================================================
-- La messagerie automatique check-in/check-out était pilotée par une config
-- LEGACY séparée (messaging_automation_config.auto_send_check_in / _check_out +
-- check_in_template_id / check_out_template_id), envoyée en dur par
-- GuestMessagingScheduler — un SECOND système parallèle au hub d'automatisation.
--
-- On consolide : le hub (automation_rules) devient l'UNIQUE source de vérité.
-- Ce changeset transforme la config legacy active en règles du hub équivalentes :
--   auto_send_check_in  = true  → règle CHECK_IN_DAY  / SEND_MESSAGE (template check-in)
--   auto_send_check_out = true  → règle CHECK_OUT_DAY / SEND_MESSAGE (template check-out)
-- Le scheduler legacy est supprimé dans le même lot → aucun double envoi.
--
-- Le mapping est fidèle : le scheduler envoyait déjà « jour J » dans le fuseau du
-- logement (les champs hours_before_* étaient morts) — exactement la sémantique
-- de CHECK_IN_DAY / CHECK_OUT_DAY (offset 0). Le hub réutilise le MÊME service
-- d'envoi (GuestMessagingService) et les MÊMES templates.
--
-- Idempotent : on ne crée pas de règle si une règle (org, déclencheur, action)
-- équivalente existe déjà. autoPushPricingEnabled reste sur l'entité (pricing).
-- ============================================================================

-- Check-in : auto_send_check_in → règle CHECK_IN_DAY / SEND_MESSAGE
INSERT INTO automation_rules (
    enabled, sort_order, trigger_offset_days, trigger_time,
    created_at, updated_at, organization_id, template_id,
    delivery_channel, action_type, trigger_type, name
)
SELECT true, 0, 0, '09:00',
       NOW(), NOW(), c.organization_id, c.check_in_template_id,
       'EMAIL', 'SEND_MESSAGE', 'CHECK_IN_DAY', 'Message de check-in'
FROM messaging_automation_config c
WHERE c.auto_send_check_in = true
  AND c.check_in_template_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM automation_rules r
      WHERE r.organization_id = c.organization_id
        AND r.trigger_type = 'CHECK_IN_DAY'
        AND r.action_type = 'SEND_MESSAGE'
  );

-- Check-out : auto_send_check_out → règle CHECK_OUT_DAY / SEND_MESSAGE
INSERT INTO automation_rules (
    enabled, sort_order, trigger_offset_days, trigger_time,
    created_at, updated_at, organization_id, template_id,
    delivery_channel, action_type, trigger_type, name
)
SELECT true, 0, 0, '09:00',
       NOW(), NOW(), c.organization_id, c.check_out_template_id,
       'EMAIL', 'SEND_MESSAGE', 'CHECK_OUT_DAY', 'Message de check-out'
FROM messaging_automation_config c
WHERE c.auto_send_check_out = true
  AND c.check_out_template_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM automation_rules r
      WHERE r.organization_id = c.organization_id
        AND r.trigger_type = 'CHECK_OUT_DAY'
        AND r.action_type = 'SEND_MESSAGE'
  );

-- Neutralise la config legacy pour couper l'ancien chemin (le scheduler est
-- supprimé, mais on remet les drapeaux à false par sûreté / cohérence d'état).
UPDATE messaging_automation_config
SET auto_send_check_in = false, auto_send_check_out = false, updated_at = NOW()
WHERE auto_send_check_in = true OR auto_send_check_out = true;
