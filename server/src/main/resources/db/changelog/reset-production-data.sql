-- ============================================================================
-- Script de RESET de la base de production
-- ============================================================================
-- ATTENTION : Ce script supprime TOUTES les donnees sauf l'utilisateur admin
-- et son organisation. Executez APRES avoir fait un backup complet.
--
-- Usage :
--   1. Creer un backup via l'admin UI ou pg_dump
--   2. docker exec clenzy-postgres-prod psql -U clenzy_prod_user -d clenzy_prod -f /path/to/reset-production-data.sql
--   OU copier-coller dans psql
-- ============================================================================

BEGIN;

-- 0. Identifier l'admin et son organisation
DO $$
DECLARE
    v_admin_id BIGINT;
    v_admin_org_id BIGINT;
BEGIN
    -- Trouver le SUPER_ADMIN
    SELECT u.id, u.organization_id
    INTO v_admin_id, v_admin_org_id
    FROM users u
    WHERE u.role = 'SUPER_ADMIN'
    ORDER BY u.id ASC
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Aucun SUPER_ADMIN trouve. Abandon du reset.';
    END IF;

    RAISE NOTICE 'Admin trouve : user_id=%, org_id=%', v_admin_id, v_admin_org_id;

    -- =========================================================================
    -- 1. Tables de log / audit / monitoring (pas de FK entrantes)
    -- =========================================================================
    TRUNCATE TABLE security_audit_log CASCADE;
    TRUNCATE TABLE kpi_snapshots CASCADE;
    TRUNCATE TABLE reconciliation_runs CASCADE;
    TRUNCATE TABLE outbox_events CASCADE;

    -- Audit log (si existant)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
        EXECUTE 'TRUNCATE TABLE audit_log CASCADE';
    END IF;

    -- =========================================================================
    -- 2. Notifications et preferences
    -- =========================================================================
    TRUNCATE TABLE notification_preferences CASCADE;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        EXECUTE 'TRUNCATE TABLE notifications CASCADE';
    END IF;

    -- =========================================================================
    -- 3. GDPR / Compliance
    -- =========================================================================
    TRUNCATE TABLE gdpr_consents CASCADE;

    -- =========================================================================
    -- 4. Contact / Formulaires
    -- =========================================================================
    TRUNCATE TABLE contact_messages CASCADE;
    TRUNCATE TABLE received_forms CASCADE;

    -- =========================================================================
    -- 5. Guest Messaging
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_message_log') THEN
        EXECUTE 'TRUNCATE TABLE guest_message_log CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messaging_automation_config') THEN
        EXECUTE 'TRUNCATE TABLE messaging_automation_config CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_templates') THEN
        EXECUTE 'TRUNCATE TABLE message_templates CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'check_in_instructions') THEN
        EXECUTE 'TRUNCATE TABLE check_in_instructions CASCADE';
    END IF;

    -- =========================================================================
    -- 6. Noise Monitoring / Alerts
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'noise_alerts') THEN
        EXECUTE 'TRUNCATE TABLE noise_alerts CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'noise_alert_time_windows') THEN
        EXECUTE 'TRUNCATE TABLE noise_alert_time_windows CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'noise_alert_configs') THEN
        EXECUTE 'TRUNCATE TABLE noise_alert_configs CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'noise_devices') THEN
        EXECUTE 'TRUNCATE TABLE noise_devices CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'minut_connections') THEN
        EXECUTE 'TRUNCATE TABLE minut_connections CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tuya_connections') THEN
        EXECUTE 'TRUNCATE TABLE tuya_connections CASCADE';
    END IF;

    -- =========================================================================
    -- 7. Calendar / Pricing
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_commands') THEN
        EXECUTE 'TRUNCATE TABLE calendar_commands CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_audit_log') THEN
        EXECUTE 'TRUNCATE TABLE rate_audit_log CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_overrides') THEN
        EXECUTE 'TRUNCATE TABLE rate_overrides CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_plans') THEN
        EXECUTE 'TRUNCATE TABLE rate_plans CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_restrictions') THEN
        EXECUTE 'TRUNCATE TABLE booking_restrictions CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_days') THEN
        EXECUTE 'TRUNCATE TABLE calendar_days CASCADE';
    END IF;

    -- =========================================================================
    -- 8. Documents
    -- =========================================================================
    TRUNCATE TABLE document_generations CASCADE;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_number_sequences') THEN
        EXECUTE 'TRUNCATE TABLE document_number_sequences CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'template_compliance_reports') THEN
        EXECUTE 'TRUNCATE TABLE template_compliance_reports CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_legal_requirements') THEN
        EXECUTE 'TRUNCATE TABLE document_legal_requirements CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_template_tags') THEN
        EXECUTE 'TRUNCATE TABLE document_template_tags CASCADE';
    END IF;
    TRUNCATE TABLE document_templates CASCADE;

    -- =========================================================================
    -- 9. Interventions / Service Requests
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intervention_photos') THEN
        EXECUTE 'TRUNCATE TABLE intervention_photos CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'interventions') THEN
        EXECUTE 'TRUNCATE TABLE interventions CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_requests') THEN
        EXECUTE 'TRUNCATE TABLE service_requests CASCADE';
    END IF;

    -- =========================================================================
    -- 10. Reservations / Guests
    -- =========================================================================
    TRUNCATE TABLE reservations CASCADE;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guests') THEN
        EXECUTE 'TRUNCATE TABLE guests CASCADE';
    END IF;

    -- =========================================================================
    -- 11. Teams / Portfolios
    -- =========================================================================
    TRUNCATE TABLE team_coverage_zones CASCADE;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
        EXECUTE 'TRUNCATE TABLE team_members CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        EXECUTE 'TRUNCATE TABLE teams CASCADE';
    END IF;
    TRUNCATE TABLE portfolio_teams CASCADE;
    TRUNCATE TABLE portfolio_clients CASCADE;
    TRUNCATE TABLE portfolios CASCADE;
    TRUNCATE TABLE property_teams CASCADE;

    -- Manager associations (anciennes tables si elles existent)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manager_properties') THEN
        EXECUTE 'TRUNCATE TABLE manager_properties CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manager_users') THEN
        EXECUTE 'TRUNCATE TABLE manager_users CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manager_teams') THEN
        EXECUTE 'TRUNCATE TABLE manager_teams CASCADE';
    END IF;

    -- =========================================================================
    -- 12. Channel / Airbnb integrations
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channel_sync_log') THEN
        EXECUTE 'TRUNCATE TABLE channel_sync_log CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channel_mappings') THEN
        EXECUTE 'TRUNCATE TABLE channel_mappings CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channel_connections') THEN
        EXECUTE 'TRUNCATE TABLE channel_connections CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'airbnb_listing_mappings') THEN
        EXECUTE 'TRUNCATE TABLE airbnb_listing_mappings CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'airbnb_webhook_events') THEN
        EXECUTE 'TRUNCATE TABLE airbnb_webhook_events CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'airbnb_connections') THEN
        EXECUTE 'TRUNCATE TABLE airbnb_connections CASCADE';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ical_feeds') THEN
        EXECUTE 'TRUNCATE TABLE ical_feeds CASCADE';
    END IF;

    -- =========================================================================
    -- 13. Properties (toutes)
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') THEN
        EXECUTE 'TRUNCATE TABLE properties CASCADE';
    END IF;

    -- =========================================================================
    -- 14. Invitations
    -- =========================================================================
    TRUNCATE TABLE invitations CASCADE;

    -- =========================================================================
    -- 15. Organization members (sauf admin)
    -- =========================================================================
    DELETE FROM organization_members WHERE user_id != v_admin_id;

    -- =========================================================================
    -- 16. Users (sauf admin)
    -- =========================================================================
    DELETE FROM users WHERE id != v_admin_id;

    -- =========================================================================
    -- 17. Organizations (sauf celle de l'admin)
    -- =========================================================================
    DELETE FROM organizations WHERE id != v_admin_org_id;

    -- =========================================================================
    -- 18. Pricing configs (si existant)
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing_configs') THEN
        EXECUTE 'TRUNCATE TABLE pricing_configs CASCADE';
    END IF;

    -- =========================================================================
    -- 19. Reset des sequences
    -- =========================================================================
    -- Remettre les sequences a une valeur coherente
    PERFORM setval(seq.sequencename::regclass, 1, false)
    FROM (
        SELECT sequencename
        FROM pg_sequences
        WHERE schemaname = 'public'
          AND sequencename NOT LIKE 'databasechangelog%'
    ) seq;

    RAISE NOTICE '✓ Reset termine. Admin user_id=% conserve avec org_id=%', v_admin_id, v_admin_org_id;

END $$;

-- Verification
SELECT 'users' AS "table", COUNT(*) AS "count" FROM users
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL SELECT 'properties', COUNT(*) FROM properties
ORDER BY "table";

COMMIT;
