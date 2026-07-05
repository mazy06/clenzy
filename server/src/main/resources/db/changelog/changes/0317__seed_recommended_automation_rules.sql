-- ============================================================================
-- 0317 : Règles d'automatisation recommandées, actives par défaut pour toutes
--        les organisations existantes
-- ============================================================================
-- Décision produit : les règles recommandées sont ACTIVES PAR DÉFAUT (plus de
-- bouton d'activation). Les nouvelles orgs sont amorcées à la création
-- (OrganizationService.seedRecommendedForOrg) ; ce changeset amorce les orgs
-- DÉJÀ existantes, de façon IDEMPOTENTE (une règle déjà présente pour un couple
-- (déclencheur, action) n'est pas dupliquée).
--
-- Jeu SÛR, sans doublon avec les flux existants (voir AutomationRuleService.RECOMMENDED) :
-- notifications staff (bruit / paiement échoué / capteur offline), intervention
-- batterie serrure, relance de facture (bornée), et 2 suggestions HITL de caution.
-- Aucune n'a de template (actions non-messaging) → pas de FK template.
-- ============================================================================

INSERT INTO automation_rules (
    enabled, sort_order, trigger_offset_days, trigger_time,
    created_at, updated_at, organization_id, delivery_channel, action_type, trigger_type, name
)
SELECT true, 100, rec.offset_days, '09:00',
       NOW(), NOW(), o.id, 'EMAIL', rec.act, rec.trig, rec.rule_name
FROM organizations o
CROSS JOIN (VALUES
    ('NOISE_ALERT',           'NOTIFY_STAFF',                    0, 'Alerte bruit → notifier l''equipe'),
    ('PAYMENT_FAILED',        'NOTIFY_STAFF',                    0, 'Paiement echoue → notifier l''equipe'),
    ('IOT_DEVICE_OFFLINE',    'NOTIFY_STAFF',                    0, 'Capteur hors ligne → notifier l''equipe'),
    ('LOCK_BATTERY_CRITICAL', 'CREATE_MAINTENANCE_INTERVENTION', 0, 'Batterie serrure critique → intervention preventive'),
    ('INVOICE_OVERDUE',       'SEND_INVOICE_REMINDER',           0, 'Facture impayee → relance'),
    ('RESERVATION_CANCELLED', 'SUGGEST_DEPOSIT_REFUND',          0, 'Annulation → suggerer un remboursement de caution'),
    ('CHECK_OUT_PASSED',      'SUGGEST_DEPOSIT_RELEASE',         2, 'Check-out J+2 → suggerer une liberation de caution')
) AS rec(trig, act, offset_days, rule_name)
WHERE NOT EXISTS (
    SELECT 1 FROM automation_rules r
    WHERE r.organization_id = o.id
      AND r.trigger_type = rec.trig
      AND r.action_type = rec.act
);
