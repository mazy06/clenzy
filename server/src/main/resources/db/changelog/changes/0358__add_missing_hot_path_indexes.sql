-- ============================================================================
-- 0358 : Index manquants sur les chemins chauds (audit perf 2026-07-21)
-- ============================================================================
-- Constat : conversations / conversation_messages n'avaient AUCUN index
-- secondaire (seq scan sur chaque affichage inbox, badge non-lus et dedup de
-- webhook entrant) ; interventions n'avait que organization_id (ecran planning,
-- auto-assignation, webhook Stripe) ; les lookups webhook/checkout de
-- reservations et service_requests n'etaient pas indexes.
-- Tous les noms de tables/colonnes verifies contre le baseline 0000 et les
-- entites JPA (@Table/@Column).
-- ============================================================================

-- ── Messagerie ──────────────────────────────────────────────────────────────
-- Vues inbox : filtre org (+ status) ORDER BY last_message_at DESC.
CREATE INDEX IF NOT EXISTS idx_conversations_org_lastmsg
    ON conversations (organization_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_org_status
    ON conversations (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_reservation
    ON conversations (reservation_id) WHERE reservation_id IS NOT NULL;
-- Fil d'une conversation (ORDER BY sent_at).
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_sent
    ON conversation_messages (conversation_id, sent_at);
-- Dedup d'ingestion webhook (org, canal, id externe) — appelee a CHAQUE message entrant.
CREATE INDEX IF NOT EXISTS idx_conv_messages_dedup
    ON conversation_messages (organization_id, channel_source, external_message_id);

-- ── Interventions (planning, auto-assignation, webhooks) ────────────────────
CREATE INDEX IF NOT EXISTS idx_interventions_org_scheduled
    ON interventions (organization_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_interventions_property_scheduled
    ON interventions (property_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_interventions_assigned_scheduled
    ON interventions (assigned_user_id, scheduled_date) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interventions_team
    ON interventions (team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interventions_service_request
    ON interventions (service_request_id);
CREATE INDEX IF NOT EXISTS idx_interventions_stripe_session
    ON interventions (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- ── Reservations (webhook Stripe + confirmation publique booking engine) ────
CREATE INDEX IF NOT EXISTS idx_reservations_stripe_session
    ON reservations (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_confirmation_code
    ON reservations (confirmation_code) WHERE confirmation_code IS NOT NULL;

-- ── Service requests ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sr_property
    ON service_requests (property_id);
CREATE INDEX IF NOT EXISTS idx_sr_status_desired_date
    ON service_requests (status, desired_date);
CREATE INDEX IF NOT EXISTS idx_sr_reservation
    ON service_requests (reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sr_stripe_session
    ON service_requests (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
-- Backlog d'auto-assignation : PENDING non assignees.
CREATE INDEX IF NOT EXISTS idx_sr_pending_unassigned
    ON service_requests (organization_id, desired_date)
    WHERE status = 'PENDING' AND assigned_to_id IS NULL;

-- ── Outbox : retries — l'index partiel 0046 ne couvre que PENDING ───────────
CREATE INDEX IF NOT EXISTS idx_outbox_events_failed
    ON outbox_events (created_at) WHERE status = 'FAILED';

-- ── Funnel : purge retention (DELETE WHERE occurred_at < cutoff) ────────────
-- idx_bfe_org_time (org, occurred_at) ne sert pas la purge cross-org.
CREATE INDEX IF NOT EXISTS idx_bfe_occurred_at
    ON booking_funnel_events (occurred_at);
