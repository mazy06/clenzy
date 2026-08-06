-- =============================================================================
-- Remise à zéro du jeu de démonstration de la constellation — DEV / LOCAL
-- =============================================================================
--
-- Supprime tout ce qu'a créé seed-constellation-demo.sql, y compris les cartes
-- HITL produites par les scans. Ne touche à AUCUNE donnée réelle : tout est
-- rattaché aux logements « [DÉMO] » ou marqué comme tel.
--
-- Usage :
--   docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev \
--     -v org=2 -f - < scripts/dev/reset-constellation-demo.sql
-- =============================================================================

\set ON_ERROR_STOP on
\if :{?org}
\else
  \set org 2
\endif
SELECT set_config('demo.org_id', :'org', false);

DO $reset$
DECLARE
    v_org   bigint := current_setting('demo.org_id')::bigint;
    v_props bigint[];
    v_res   bigint[];
    v_conv  bigint[];
    v_int   bigint[];
    v_count int;
BEGIN
    SELECT coalesce(array_agg(id), '{}') INTO v_props
      FROM properties WHERE organization_id = v_org AND name LIKE '[DÉMO]%';

    IF array_length(v_props, 1) IS NULL THEN
        RAISE NOTICE 'Aucun logement de démonstration pour l''organisation % — rien à supprimer.', v_org;
    END IF;

    SELECT coalesce(array_agg(id), '{}') INTO v_res
      FROM reservations WHERE property_id = ANY (v_props);
    SELECT coalesce(array_agg(id), '{}') INTO v_conv
      FROM conversations WHERE property_id = ANY (v_props);
    SELECT coalesce(array_agg(id), '{}') INTO v_int
      FROM interventions WHERE property_id = ANY (v_props);

    -- Cartes produites par les scans, LIMITÉES aux logements de démonstration.
    -- Les cartes transverses (RGPD, traduction du site, taxe de séjour) sont
    -- ancrées sur le plus petit identifiant de bien de l'organisation, souvent
    -- un bien RÉEL : elles survivent donc, sauf purge explicite.
    DELETE FROM supervision_suggestion WHERE property_id = ANY (v_props);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Cartes de démonstration supprimées : %', v_count;
    RAISE NOTICE 'Les cartes transverses ancrées sur un bien réel sont conservées. '
                 'Pour tout purger : DELETE FROM supervision_suggestion WHERE organization_id = %;', v_org;

    DELETE FROM message_intents WHERE conversation_id = ANY (v_conv);
    DELETE FROM conversation_messages WHERE conversation_id = ANY (v_conv);
    DELETE FROM conversations WHERE id = ANY (v_conv);

    DELETE FROM guest_message_log WHERE reservation_id = ANY (v_res);
    DELETE FROM message_templates WHERE organization_id = v_org AND name LIKE '[DÉMO]%';

    DELETE FROM housekeeper_payout_records WHERE intervention_id = ANY (v_int);
    DELETE FROM service_quotes WHERE property_id = ANY (v_props);
    DELETE FROM interventions WHERE id = ANY (v_int);
    DELETE FROM service_requests WHERE property_id = ANY (v_props);

    DELETE FROM guest_declarations WHERE reservation_id = ANY (v_res);
    DELETE FROM security_deposits WHERE reservation_id = ANY (v_res);
    DELETE FROM welcome_guide_tokens WHERE reservation_id = ANY (v_res);
    DELETE FROM welcome_guides WHERE property_id = ANY (v_props);

    DELETE FROM calendar_days WHERE property_id = ANY (v_props);
    DELETE FROM rate_plans WHERE property_id = ANY (v_props);
    DELETE FROM smart_lock_devices WHERE property_id = ANY (v_props);
    DELETE FROM property_stock_items WHERE property_id = ANY (v_props);
    DELETE FROM property_licenses WHERE property_id = ANY (v_props);
    DELETE FROM tourist_tax_configs WHERE property_id = ANY (v_props);
    DELETE FROM guest_reviews WHERE property_id = ANY (v_props);
    DELETE FROM management_contracts WHERE property_id = ANY (v_props);
    DELETE FROM channex_property_mapping WHERE clenzy_property_id = ANY (v_props);

    DELETE FROM reservations WHERE id = ANY (v_res);
    DELETE FROM properties WHERE id = ANY (v_props);

    DELETE FROM upsell_offers WHERE organization_id = v_org AND title LIKE '[DÉMO]%';
    DELETE FROM owner_payouts WHERE organization_id = v_org AND notes = '[DÉMO]';
    DELETE FROM privacy_requests WHERE organization_id = v_org AND notes = '[DÉMO]';
    DELETE FROM market_data_snapshots WHERE source = 'DEMO';
    DELETE FROM site_pages WHERE site_id IN (SELECT id FROM sites WHERE slug = 'demo-supervision-' || v_org);
    DELETE FROM sites WHERE organization_id = v_org AND slug = 'demo-supervision-' || v_org;

    -- Aucun voyageur à supprimer : le seed n'en crée pas, il réutilise un
    -- voyageur existant (leurs champs sont chiffrés au repos, un insert SQL en
    -- clair casserait toute lecture).

    RAISE NOTICE 'Jeu de démonstration supprimé pour l''organisation %.', v_org;
END
$reset$;
