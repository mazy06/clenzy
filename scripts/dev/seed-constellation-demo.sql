-- =============================================================================
-- Jeu de démonstration de la constellation d'agents — DEV / LOCAL UNIQUEMENT
-- =============================================================================
--
-- Ce script ne crée AUCUNE carte HITL. Il crée les SITUATIONS MÉTIER que les
-- scanners déterministes lisent : séjours, interventions, avis, stocks, mandats,
-- conversations, intentions de message. Les cartes apparaissent ensuite en
-- lançant un scan (bouton « Scanner » de la constellation, ou l'endpoint
-- POST /api/ai/supervision/scan/{propertyId}).
--
-- Usage :
--   docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev \
--     -v org=2 -f - < scripts/dev/seed-constellation-demo.sql
--
-- Idempotent : si les logements « [DÉMO] » existent déjà, le script ne fait rien.
-- Pour repartir de zéro : scripts/dev/reset-constellation-demo.sql
--
-- Huit logements, un rôle chacun. Ce découpage n'est pas cosmétique : les règles
-- d'occupation sont mutuellement exclusives (on ne peut pas être à la fois
-- sous-occupé et sur-occupé), il FAUT donc des biens distincts pour les voir
-- toutes.
-- =============================================================================

\set ON_ERROR_STOP on
\if :{?org}
\else
  \set org 2
\endif
SELECT set_config('demo.org_id', :'org', false);

DO $seed$
DECLARE
    v_org      bigint := current_setting('demo.org_id')::bigint;
    v_owner    bigint;
    v_kc       text;
    d          date := current_date;
    ts         timestamp := now();

    p_low  bigint; p_arr  bigint; p_dep bigint; p_stay bigint;
    p_free bigint; p_high bigint; p_over bigint; p_mid  bigint;

    g_email bigint;   -- voyageur EXISTANT ayant un email (cf. note sur le chiffrement)

    r_past bigint; r_arr bigint; r_dep bigint; r_next bigint;
    r_stay bigint; r_owner bigint; r_noguide bigint;

    i_works bigint; i_clean bigint; v_req bigint;
    c_hot bigint; c_late bigint; c_change bigint; c_complaint bigint;
    m_msg bigint;
    v_site bigint; v_tpl bigint;
    k int;
BEGIN
    SELECT id, keycloak_id INTO v_owner, v_kc
      FROM users
     WHERE organization_id = v_org AND keycloak_id IS NOT NULL
     ORDER BY id LIMIT 1;

    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'Aucun utilisateur avec keycloak_id dans l''organisation % — impossible de semer.', v_org;
    END IF;

    IF EXISTS (SELECT 1 FROM properties WHERE organization_id = v_org AND name = '[DÉMO] Villa Amboise') THEN
        RAISE NOTICE 'Jeu de démonstration déjà présent pour l''organisation % — rien à faire.', v_org;
        RETURN;
    END IF;

    -- -------------------------------------------------------------------------
    -- 1. Les huit logements
    -- -------------------------------------------------------------------------
    -- La Villa est antidatée de deux ans : la tournée de maintenance préventive
    -- ne se propose que sur un bien de plus de onze mois.
    INSERT INTO properties (organization_id, owner_id, name, address, postal_code, city, country_code,
                            timezone, type, status, bedroom_count, bathroom_count, max_guests,
                            nightly_price, maintenance_contract, created_at)
    VALUES (v_org, v_owner, '[DÉMO] Villa Amboise', '12 rue de la Démonstration', '33000', 'Bordeaux', 'FR',
            'Europe/Paris', 'APARTMENT', 'ACTIVE', 2, 1, 4, 110.00, false, ts - interval '2 years')
    RETURNING id INTO p_low;

    INSERT INTO properties (organization_id, owner_id, name, address, postal_code, city, country_code,
                            timezone, type, status, bedroom_count, bathroom_count, max_guests, nightly_price, maintenance_contract, created_at)
    VALUES (v_org, v_owner, '[DÉMO] Loft Bastille', '3 rue de la Roquette', '75011', 'Paris', 'FR',
            'Europe/Paris', 'LOFT', 'ACTIVE', 1, 1, 2, 130.00, false, ts)
    RETURNING id INTO p_arr;

    INSERT INTO properties (organization_id, owner_id, name, address, postal_code, city, country_code,
                            timezone, type, status, bedroom_count, bathroom_count, max_guests, nightly_price, maintenance_contract, created_at)
    VALUES (v_org, v_owner, '[DÉMO] Studio Canal', '8 quai de Jemmapes', '75010', 'Paris', 'FR',
            'Europe/Paris', 'STUDIO', 'ACTIVE', 1, 1, 2, 95.00, false, ts)
    RETURNING id INTO p_dep;

    INSERT INTO properties (organization_id, owner_id, name, address, postal_code, city, country_code,
                            timezone, type, status, bedroom_count, bathroom_count, max_guests, nightly_price, maintenance_contract, created_at)
    VALUES (v_org, v_owner, '[DÉMO] Maison Loire', '5 rue Nationale', '37000', 'Tours', 'FR',
            'Europe/Paris', 'HOUSE', 'ACTIVE', 3, 2, 6, 140.00, false, ts)
    RETURNING id INTO p_stay;

    -- Volontairement laissée libre : c'est la destination du relogement.
    INSERT INTO properties (organization_id, owner_id, name, address, postal_code, city, country_code,
                            timezone, type, status, bedroom_count, bathroom_count, max_guests, nightly_price, maintenance_contract, created_at)
    VALUES (v_org, v_owner, '[DÉMO] Le Cottage', '22 rue des Tanneurs', '37000', 'Tours', 'FR',
            'Europe/Paris', 'COTTAGE', 'ACTIVE', 3, 1, 6, 120.00, false, ts)
    RETURNING id INTO p_free;

    INSERT INTO properties (organization_id, owner_id, name, address, postal_code, city, country_code,
                            timezone, type, status, bedroom_count, bathroom_count, max_guests, nightly_price, maintenance_contract, created_at)
    VALUES (v_org, v_owner, '[DÉMO] Résidence Marina', '1 promenade des Anglais', '06000', 'Nice', 'FR',
            'Europe/Paris', 'APARTMENT', 'ACTIVE', 2, 1, 4, 80.00, false, ts)
    RETURNING id INTO p_high;

    INSERT INTO properties (organization_id, owner_id, name, address, postal_code, city, country_code,
                            timezone, type, status, bedroom_count, bathroom_count, max_guests, nightly_price, maintenance_contract, created_at)
    VALUES (v_org, v_owner, '[DÉMO] Duplex Croisette', '40 bd de la Croisette', '06400', 'Cannes', 'FR',
            'Europe/Paris', 'DUPLEX', 'ACTIVE', 2, 2, 4, 160.00, false, ts)
    RETURNING id INTO p_over;

    INSERT INTO properties (organization_id, owner_id, name, address, postal_code, city, country_code,
                            timezone, type, status, bedroom_count, bathroom_count, max_guests, nightly_price, maintenance_contract, created_at)
    VALUES (v_org, v_owner, '[DÉMO] Appartement Gambetta', '17 cours Gambetta', '69003', 'Lyon', 'FR',
            'Europe/Paris', 'APARTMENT', 'ACTIVE', 2, 1, 4, 100.00, false, ts)
    RETURNING id INTO p_mid;

    -- -------------------------------------------------------------------------
    -- 2. Occupation — pilote toutes les règles tarifaires
    -- -------------------------------------------------------------------------
    -- Marina : 87 nuits occupées sur 90, avec un trou de 3 nuits. Le trou est
    -- indispensable : sans créneau libre contigu, le scanner n'a rien à proposer.
    INSERT INTO calendar_days (organization_id, property_id, date, status, source, created_at)
    SELECT v_org, p_high, gs::date, 'BOOKED', 'DEMO', ts FROM generate_series(d + 1, d + 60, '1 day') gs;
    INSERT INTO calendar_days (organization_id, property_id, date, status, source, created_at)
    SELECT v_org, p_high, gs::date, 'BOOKED', 'DEMO', ts FROM generate_series(d + 64, d + 90, '1 day') gs;

    -- Gambetta : ~65 %. Ni assez bas pour une baisse, ni assez haut pour une
    -- hausse — c'est ce qui laisse remonter les constats de sous-performance.
    INSERT INTO calendar_days (organization_id, property_id, date, status, source, created_at)
    SELECT v_org, p_mid, gs::date, 'BOOKED', 'DEMO', ts FROM generate_series(d + 1, d + 59, '1 day') gs;

    -- -------------------------------------------------------------------------
    -- 3. Voyageurs et séjours
    -- -------------------------------------------------------------------------
    -- ⚠️ ON NE CRÉE AUCUN VOYAGEUR. guests.email / phone / first_name / last_name
    -- sont chiffrés AES-256 au repos (EncryptedFieldConverter, RGPD art. 32).
    -- Y écrire du texte clair fait échouer le déchiffrement à la LECTURE : toute
    -- requête chargeant ce voyageur part en 500, et le planning se vide — y
    -- compris pour les logements réels. Même piège sur guest_declarations, dont
    -- toute l'identité est chiffrée : on laisse ces colonnes à NULL.
    -- On réutilise donc un voyageur existant, dont l'email est déjà chiffré.
    SELECT id INTO g_email FROM guests
     WHERE organization_id = v_org AND email IS NOT NULL ORDER BY id LIMIT 1;
    IF g_email IS NULL THEN
        RAISE EXCEPTION 'Aucun voyageur avec email dans l''organisation % : la demande d''avis '
                        'et les offres additionnelles ont besoin d''un email résoluble.', v_org;
    END IF;
    -- Le cas « fiche client incomplète » se joue avec guest_id à NULL : la règle
    -- accepte aussi bien un voyageur absent qu'un email vide.

    -- Départ d'hier : demande d'avis, geste commercial, retenue de caution.
    INSERT INTO reservations (organization_id, property_id, guest_id, guest_name, guest_count, check_in, check_out,
                              status, source, currency, total_price, payment_collection, created_at, no_show)
    VALUES (v_org, p_low, g_email, '[DÉMO] Voyageur', 2, d - 4, d - 1,
            'confirmed', 'direct', 'EUR', 450.00, 'PMS', ts - interval '10 days', false)
    RETURNING id INTO r_past;

    -- Arrivée demain, sur un bien AVEC livret : envoi du livret + arrivée anticipée.
    INSERT INTO reservations (organization_id, property_id, guest_id, guest_name, guest_count, check_in, check_out,
                              status, source, currency, total_price, payment_collection, created_at, no_show)
    VALUES (v_org, p_arr, g_email, '[DÉMO] Voyageur', 2, d + 1, d + 4,
            'confirmed', 'airbnb', 'EUR', 390.00, 'CHANNEL', ts - interval '20 days', false)
    RETURNING id INTO r_arr;

    -- Départ demain : départ tardif proposable.
    INSERT INTO reservations (organization_id, property_id, guest_id, guest_name, guest_count, check_in, check_out,
                              status, source, currency, total_price, payment_collection, created_at, no_show)
    VALUES (v_org, p_dep, g_email, '[DÉMO] Voyageur', 2, d - 2, d + 1,
            'confirmed', 'direct', 'EUR', 310.00, 'PMS', ts - interval '15 days', false)
    RETURNING id INTO r_dep;

    -- Arrivée dans deux jours, voyageur sans email.
    INSERT INTO reservations (organization_id, property_id, guest_id, guest_name, guest_count, check_in, check_out,
                              status, source, currency, total_price, payment_collection, created_at, no_show)
    VALUES (v_org, p_dep, NULL, '[DÉMO] Voyageur', 2, d + 2, d + 5,
            'confirmed', 'booking', 'EUR', 280.00, 'CHANNEL', ts - interval '5 days', false)
    RETURNING id INTO r_next;

    -- Séjour commencé, aucun signe de vie : no-show probable, et support du relogement.
    INSERT INTO reservations (organization_id, property_id, guest_id, guest_name, guest_count, check_in, check_out,
                              status, source, currency, total_price, payment_collection, created_at, no_show)
    VALUES (v_org, p_stay, g_email, '[DÉMO] Voyageur', 2, d - 2, d + 3,
            'confirmed', 'airbnb', 'EUR', 520.00, 'CHANNEL', ts - interval '30 days', false)
    RETURNING id INTO r_stay;

    -- Deux séjours qui se chevauchent sur le même bien.
    INSERT INTO reservations (organization_id, property_id, guest_id, guest_name, guest_count, check_in, check_out,
                              status, source, currency, total_price, payment_collection, created_at, no_show)
    VALUES (v_org, p_over, g_email, '[DÉMO] Voyageur', 2, d + 5, d + 10,
            'confirmed', 'airbnb', 'EUR', 640.00, 'CHANNEL', ts - interval '9 days', false);
    INSERT INTO reservations (organization_id, property_id, guest_id, guest_name, guest_count, check_in, check_out,
                              status, source, currency, total_price, payment_collection, created_at, no_show)
    VALUES (v_org, p_over, g_email, '[DÉMO] Voyageur', 2, d + 7, d + 12,
            'confirmed', 'booking', 'EUR', 700.00, 'CHANNEL', ts - interval '2 days', false);

    -- Séjour passé sur le bien confié : support de la déclaration de police.
    INSERT INTO reservations (organization_id, property_id, guest_id, guest_name, guest_count, check_in, check_out,
                              status, source, currency, total_price, payment_collection, created_at, no_show)
    VALUES (v_org, p_free, g_email, '[DÉMO] Voyageur', 2, d - 9, d - 5,
            'confirmed', 'direct', 'EUR', 410.00, 'PMS', ts - interval '20 days', false)
    RETURNING id INTO r_owner;

    -- Arrivée demain sur un bien SANS livret : le pendant négatif du livret à envoyer.
    INSERT INTO reservations (organization_id, property_id, guest_id, guest_name, guest_count, check_in, check_out,
                              status, source, currency, total_price, payment_collection, created_at, no_show)
    VALUES (v_org, p_mid, g_email, '[DÉMO] Voyageur', 2, d + 1, d + 3,
            'confirmed', 'direct', 'EUR', 240.00, 'PMS', ts - interval '7 days', false)
    RETURNING id INTO r_noguide;

    -- Mois écoulé très en deçà du même mois l'an dernier → note au propriétaire.
    INSERT INTO reservations (organization_id, property_id, guest_name, guest_count, check_in, check_out,
                              status, source, currency, total_price, payment_collection, created_at, no_show)
    VALUES (v_org, p_low, 'Voyageur démo', 2, date_trunc('month', d - interval '1 month')::date + 6,
            date_trunc('month', d - interval '1 month')::date + 9,
            'confirmed', 'direct', 'EUR', 300.00, 'PMS', ts - interval '45 days', false);

    FOR k IN 0..3 LOOP
        INSERT INTO reservations (organization_id, property_id, guest_name, guest_count, check_in, check_out,
                                  status, source, currency, total_price, payment_collection, created_at, no_show)
        VALUES (v_org, p_low, 'Voyageur démo', 2,
                date_trunc('month', d - interval '13 months')::date + 1 + k * 6,
                date_trunc('month', d - interval '13 months')::date + 5 + k * 6,
                'confirmed', 'airbnb', 'EUR', 620.00, 'CHANNEL', ts - interval '400 days', false);
    END LOOP;

    -- Même période l'an dernier, bien mieux remplie → retard commercial.
    FOR k IN 0..9 LOOP
        INSERT INTO reservations (organization_id, property_id, guest_name, guest_count, check_in, check_out,
                                  status, source, currency, total_price, payment_collection, created_at, no_show)
        VALUES (v_org, p_mid, 'Voyageur démo', 2, d - 364 + k * 7, d - 359 + k * 7,
                'confirmed', 'airbnb', 'EUR', 620.00, 'CHANNEL', ts - interval '380 days', false);
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 4. Exploitation — serrure, travaux, devis, ménage, stock
    -- -------------------------------------------------------------------------
    INSERT INTO smart_lock_devices (organization_id, property_id, user_id, name, brand, access_code_mode,
                                    status, battery_level, online, created_at)
    VALUES (v_org, p_low, v_kc, '[DÉMO] Serrure entrée', 'NUKI', 'PMS_GENERATED', 'ACTIVE', 12, true, ts);

    -- Travaux ouverts et coûteux : approbation propriétaire + arbitrage de devis.
    INSERT INTO service_requests (organization_id, property_id, user_id, title, service_type, priority,
                                  status, desired_date, created_at, is_urgent)
    VALUES (v_org, p_low, v_owner, '[DÉMO] Fuite salle de bain', 'PLUMBING_REPAIR', 'NORMAL', 'PENDING', ts, ts, false) RETURNING id INTO v_req;
    INSERT INTO interventions (organization_id, property_id, requestor_id, service_request_id, title, type,
                               status, priority, scheduled_date, start_time, created_at,
                               estimated_cost, currency)
    VALUES (v_org, p_low, v_owner, v_req, '[DÉMO] Fuite salle de bain', 'MAINTENANCE',
            'PENDING', 'NORMAL', ts, ts, ts, 380.00, 'EUR')
    RETURNING id INTO i_works;

    INSERT INTO service_quotes (organization_id, property_id, intervention_id, provider_name, provider_email,
                                amount, currency, status, valid_until, created_at)
    VALUES (v_org, p_low, i_works, 'Plomberie du Port', 'devis@plomberie-du-port.fr', 380.00, 'EUR', 'RECEIVED', d + 21, ts),
           (v_org, p_low, i_works, 'AquaService', 'devis@aquaservice.fr', 455.00, 'EUR', 'RECEIVED', d + 21, ts);

    -- Panne SURVENUE PENDANT le séjour → geste commercial proposable.
    INSERT INTO service_requests (organization_id, property_id, user_id, title, service_type, priority,
                                  status, desired_date, created_at, is_urgent)
    VALUES (v_org, p_low, v_owner, '[DÉMO] Chauffage HS', 'HVAC_REPAIR', 'NORMAL', 'IN_PROGRESS',
            (d - 3)::timestamp, (d - 3)::timestamp, false) RETURNING id INTO v_req;
    INSERT INTO interventions (organization_id, property_id, requestor_id, service_request_id, title, type,
                               status, priority, scheduled_date, start_time, created_at, estimated_cost, currency)
    VALUES (v_org, p_low, v_owner, v_req, '[DÉMO] Chauffage HS', 'MAINTENANCE',
            'IN_PROGRESS', 'NORMAL', (d - 3)::timestamp, (d - 3)::timestamp, (d - 3)::timestamp, 120.00, 'EUR');

    -- Ménage terminé mais versement refusé par la banque.
    INSERT INTO service_requests (organization_id, property_id, user_id, title, service_type, priority,
                                  status, desired_date, created_at, is_urgent)
    VALUES (v_org, p_low, v_owner, '[DÉMO] Ménage de départ', 'CLEANING', 'NORMAL', 'COMPLETED',
            ts - interval '1 day', ts - interval '1 day', false) RETURNING id INTO v_req;
    INSERT INTO interventions (organization_id, property_id, requestor_id, service_request_id, assigned_user_id,
                               title, type, status, priority, scheduled_date, start_time, created_at,
                               estimated_cost, actual_cost, currency)
    VALUES (v_org, p_low, v_owner, v_req, v_owner, '[DÉMO] Ménage de départ', 'CLEANING',
            'COMPLETED', 'NORMAL', ts - interval '1 day', ts - interval '1 day', ts - interval '1 day',
            90.00, 90.00, 'EUR')
    RETURNING id INTO i_clean;

    INSERT INTO housekeeper_payout_records (organization_id, user_id, intervention_id, amount, commission_amount,
                                            status, failure_reason, created_at)
    VALUES (v_org, v_owner, i_clean, 90.00, 9.00, 'FAILED', 'Virement refusé par la banque (démo)', ts);

    -- Avec fournisseur → réassort actionnable ; sans → simple constat.
    INSERT INTO property_stock_items (organization_id, property_id, name, category, unit, quantity,
                                      reorder_threshold, reorder_quantity, consumption_per_stay,
                                      supplier_name, supplier_email, created_at)
    VALUES (v_org, p_low, 'Draps 140x190', 'LINEN', 'unité', 2, 6, 12, 2, 'Fournisseur démo', 'linge@fournisseur-demo.fr', ts),
           (v_org, p_low, 'Capsules café', 'CONSUMABLES', 'unité', 1, 5, 0, 2, NULL, NULL, ts);

    -- Panne bloquante et urgente sur un bien occupé → relogement à proposer.
    INSERT INTO service_requests (organization_id, property_id, user_id, title, service_type, priority,
                                  status, desired_date, created_at, is_urgent)
    VALUES (v_org, p_stay, v_owner, '[DÉMO] Dégât des eaux', 'EMERGENCY_REPAIR', 'HIGH', 'PENDING',
            ts - interval '6 hours', ts - interval '6 hours', false) RETURNING id INTO v_req;
    INSERT INTO interventions (organization_id, property_id, requestor_id, service_request_id, title, type,
                               status, priority, scheduled_date, start_time, created_at, estimated_cost, currency)
    VALUES (v_org, p_stay, v_owner, v_req, '[DÉMO] Dégât des eaux', 'MAINTENANCE',
            'PENDING', 'HIGH', ts - interval '6 hours', ts - interval '6 hours', ts - interval '6 hours', 250.00, 'EUR');

    -- -------------------------------------------------------------------------
    -- 5. Voyageur — livrets, offres, avis
    -- -------------------------------------------------------------------------
    -- Un livret publié conditionne l'envoi du livret, la demande d'avis ET les
    -- offres additionnelles. Gambetta n'en a délibérément pas.
    INSERT INTO welcome_guides (organization_id, property_id, language, title, sections, published,
                                welcome_message, created_at, updated_at)
    VALUES (v_org, p_arr, 'fr', '[DÉMO] Bienvenue — Paris', '[]'::jsonb, true, 'Excellent séjour !', ts, ts),
           (v_org, p_dep, 'fr', '[DÉMO] Bienvenue — Canal', '[]'::jsonb, true, 'Excellent séjour !', ts, ts),
           (v_org, p_low, 'fr', '[DÉMO] Bienvenue — Bordeaux', '[]'::jsonb, true, 'Excellent séjour !', ts, ts);

    INSERT INTO upsell_offers (organization_id, property_id, type, title, price, currency, active, sort_order,
                               diffuse_on_livret, diffuse_on_booking, created_at, updated_at)
    VALUES (v_org, NULL, 'EARLY_CHECKIN', '[DÉMO] Arrivée anticipée dès 11 h', 35.00, 'EUR', true, 0, true, true, ts, ts),
           (v_org, NULL, 'LATE_CHECKOUT', '[DÉMO] Départ tardif jusqu''à 16 h', 30.00, 'EUR', true, 1, true, true, ts, ts);

    INSERT INTO guest_reviews (organization_id, property_id, channel_name, guest_name, rating, review_text,
                               review_date, is_public)
    VALUES (v_org, p_low, 'AIRBNB', 'Voyageur démo', 2,
            'Chauffage en panne pendant deux nuits, personne n''a répondu.', d - 2, true),
           (v_org, p_low, 'AIRBNB', 'Voyageur démo', 5,
            'Séjour parfait, appartement impeccable et très bien situé.', d - 3, true);

    -- -------------------------------------------------------------------------
    -- 6. Messagerie — conversation qui chauffe, intentions, échec d'envoi
    -- -------------------------------------------------------------------------
    -- Trois messages entrants en moins de trente minutes, personne aux commandes.
    -- Le dernier message doit porter EXACTEMENT last_message_at : c'est la
    -- condition de la requête, pas un détail cosmétique.
    INSERT INTO conversations (organization_id, property_id, channel, status, subject, last_message_preview,
                               last_message_at, assigned_to_keycloak_id, unread, message_count, created_at, updated_at)
    VALUES (v_org, p_low, 'EMAIL', 'OPEN', '[DÉMO] Conversation voyageur', 'Il y a quelqu''un ?',
            date_trunc('second', ts - interval '2 minutes'), NULL, true, 3, ts, ts)
    RETURNING id INTO c_hot;
    INSERT INTO conversation_messages (organization_id, conversation_id, direction, channel_source, sender_name, content, sent_at)
    VALUES (v_org, c_hot, 'INBOUND', 'EMAIL', 'Voyageur démo', 'Bonjour, le code d''entrée ne marche pas.',
            date_trunc('second', ts - interval '20 minutes')),
           (v_org, c_hot, 'INBOUND', 'EMAIL', 'Voyageur démo', 'Toujours rien, on est devant la porte.',
            date_trunc('second', ts - interval '9 minutes')),
           (v_org, c_hot, 'INBOUND', 'EMAIL', 'Voyageur démo', 'Il y a quelqu''un ?',
            date_trunc('second', ts - interval '2 minutes'));

    -- Le classifieur d'intentions est un appel LLM que le scanner n'effectue pas
    -- lui-même : il lit message_intents. Écrire cette table est donc la
    -- simulation fidèle — on court-circuite la classification, pas la règle.
    INSERT INTO conversations (organization_id, property_id, reservation_id, guest_id, channel, status, subject,
                               last_message_preview, last_message_at, assigned_to_keycloak_id, unread,
                               message_count, created_at, updated_at)
    VALUES (v_org, p_dep, r_dep, g_email, 'EMAIL', 'OPEN', '[DÉMO] Départ tardif ?',
            'On peut partir plus tard ?', ts - interval '3 hours', NULL, true, 1, ts, ts)
    RETURNING id INTO c_late;
    INSERT INTO conversation_messages (organization_id, conversation_id, direction, channel_source, sender_name, content, sent_at)
    VALUES (v_org, c_late, 'INBOUND', 'EMAIL', '[DÉMO] Voyageur', 'On peut partir plus tard demain ?',
            ts - interval '3 hours')
    RETURNING id INTO m_msg;
    INSERT INTO message_intents (organization_id, conversation_id, message_id, intent, confidence, extracted, model, created_at)
    VALUES (v_org, c_late, m_msg, 'LATE_CHECKOUT_REQUEST', 0.930, '{"requestedTime":"14h"}', 'demo-seed', ts);

    INSERT INTO conversations (organization_id, property_id, reservation_id, guest_id, channel, status, subject,
                               last_message_preview, last_message_at, assigned_to_keycloak_id, unread,
                               message_count, created_at, updated_at)
    VALUES (v_org, p_dep, r_next, NULL, 'EMAIL', 'OPEN', '[DÉMO] Décaler le séjour',
            'Notre vol a bougé', ts - interval '4 hours', NULL, true, 1, ts, ts)
    RETURNING id INTO c_change;
    INSERT INTO conversation_messages (organization_id, conversation_id, direction, channel_source, sender_name, content, sent_at)
    VALUES (v_org, c_change, 'INBOUND', 'EMAIL', '[DÉMO] Voyageur', 'Notre vol a bougé, peut-on décaler ?',
            ts - interval '4 hours')
    RETURNING id INTO m_msg;
    INSERT INTO message_intents (organization_id, conversation_id, message_id, intent, confidence, extracted, model, created_at)
    VALUES (v_org, c_change, m_msg, 'STAY_CHANGE_REQUEST', 0.910,
            jsonb_build_object('newCheckIn', d + 8, 'newCheckOut', d + 11), 'demo-seed', ts);

    INSERT INTO conversations (organization_id, property_id, reservation_id, guest_id, channel, status, subject,
                               last_message_preview, last_message_at, assigned_to_keycloak_id, unread,
                               message_count, created_at, updated_at)
    VALUES (v_org, p_arr, r_arr, g_email, 'EMAIL', 'OPEN', '[DÉMO] Réclamation',
            'C''est inadmissible', ts - interval '5 hours', NULL, true, 1, ts, ts)
    RETURNING id INTO c_complaint;
    INSERT INTO conversation_messages (organization_id, conversation_id, direction, channel_source, sender_name, content, sent_at)
    VALUES (v_org, c_complaint, 'INBOUND', 'EMAIL', '[DÉMO] Voyageur', 'C''est inadmissible, personne ne répond.',
            ts - interval '5 hours')
    RETURNING id INTO m_msg;
    INSERT INTO message_intents (organization_id, conversation_id, message_id, intent, confidence, extracted, model, created_at)
    VALUES (v_org, c_complaint, m_msg, 'COMPLAINT', 0.930, NULL, 'demo-seed', ts);

    -- Un envoi en échec n'ouvre une carte que si le log porte un gabarit typé.
    INSERT INTO message_templates (organization_id, name, type, subject, body, language, is_active, created_at)
    VALUES (v_org, '[DÉMO] Instructions d''arrivée', 'CHECK_IN', 'Votre arrivée',
            'Voici les informations d''accès.', 'fr', true, ts)
    RETURNING id INTO v_tpl;
    INSERT INTO guest_message_log (organization_id, reservation_id, guest_id, template_id, channel, recipient,
                                   subject, status, error_message, created_at)
    VALUES (v_org, r_dep, g_email, v_tpl, 'EMAIL', 'adresse-invalide@exemple-demo.invalid', 'Votre arrivée',
            'FAILED', 'Adresse rejetée par le serveur distant (démo)', ts - interval '1 day');

    -- -------------------------------------------------------------------------
    -- 7. Finance et propriétaire
    -- -------------------------------------------------------------------------
    INSERT INTO security_deposits (organization_id, reservation_id, amount, currency, status, created_at, updated_at)
    VALUES (v_org, r_past, 500.00, 'EUR', 'HELD', ts, ts);

    INSERT INTO owner_payouts (organization_id, owner_id, period_start, period_end, gross_revenue,
                               commission_rate, commission_amount, ota_fees, net_amount, currency,
                               status, generation_type, notes, created_at)
    VALUES (v_org, v_owner, date_trunc('month', d - interval '1 month')::date,
            (date_trunc('month', d)::date - 1), 3200.00, 0.1800, 576.00, 124.00, 2500.00, 'EUR',
            'PENDING', 'MANUAL', '[DÉMO]', ts);

    -- -------------------------------------------------------------------------
    -- 8. Conformité
    -- -------------------------------------------------------------------------
    -- Identité laissée à NULL : ces colonnes sont chiffrées (cf. note plus haut).
    -- Le scanner n'a besoin que du statut et du drapeau de transmission.
    INSERT INTO guest_declarations (organization_id, reservation_id, guest_id, is_primary, status,
                                    submitted_to_provider, created_at, updated_at)
    VALUES (v_org, r_past,  g_email, true, 'COMPLETED', false, ts, ts),
           (v_org, r_owner, g_email, true, 'COMPLETED', false, ts, ts);

    -- Mandat en brouillon jamais envoyé à la signature.
    INSERT INTO management_contracts (organization_id, property_id, owner_id, contract_type, status, start_date,
                                      commission_rate, payment_model, commission_base, ota_fee_borne_by, created_at, updated_at)
    VALUES (v_org, p_low, v_owner, 'FULL_MANAGEMENT', 'DRAFT', d - 60, 0.1800,
            'CONCIERGE_COLLECTS', 'NET_OF_OTA_FEE', 'AGENCY', ts, ts);

    -- Mandat actif sur le bien confié : sert le cas « le propriétaire porte
    -- l'obligation ». Les colonnes de ventilation n'existent qu'après la
    -- migration 0394 — on ne les renseigne que si elles sont là.
    INSERT INTO management_contracts (organization_id, property_id, owner_id, contract_type, status, start_date,
                                      commission_rate, payment_model, commission_base, ota_fee_borne_by, created_at, updated_at)
    VALUES (v_org, p_free, v_owner, 'FULL_MANAGEMENT', 'ACTIVE', d - 90, 0.1500,
            'OWNER_COLLECTS', 'GROSS', 'OWNER', ts, ts);

    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'management_contracts' AND column_name = 'police_declaration_by') THEN
        UPDATE management_contracts
           SET police_declaration_by = 'OWNER', tourist_tax_by = 'OWNER', licence_held_by = 'OWNER'
         WHERE organization_id = v_org AND property_id = p_free;
    ELSE
        RAISE NOTICE 'Colonnes de ventilation du mandat absentes (migration 0394 non appliquée) : '
                     'le constat « le propriétaire porte la déclaration » ne sortira pas.';
    END IF;

    INSERT INTO property_licenses (organization_id, property_id, license_type, license_number, issued_by,
                                   issued_at, expires_at, renewal_lead_days, created_at, updated_at)
    VALUES (v_org, p_low, 'SHORT_TERM_RENTAL', 'DEMO-2026-0042', 'Mairie de Bordeaux',
            d - 365, d + 18, 60, ts, ts);

    -- Deux demandes RGPD : l'une rattachée (effacement exécutable), l'autre
    -- orpheline (rattachement manuel requis).
    INSERT INTO privacy_requests (organization_id, guest_id, requester_email, type, status, requested_at, due_at, notes, created_at, updated_at)
    VALUES (v_org, g_email, 'ancien.voyageur@exemple-demo.fr', 'ERASURE', 'RECEIVED', d - 26, d + 4, '[DÉMO]', ts, ts),
           (v_org, NULL, 'inconnu@exemple-demo.fr', 'ERASURE', 'RECEIVED', d - 12, d + 18, '[DÉMO]', ts, ts);

    INSERT INTO tourist_tax_configs (organization_id, property_id, commune_name, calculation_mode,
                                     rate_per_person, exempt_minors, enabled, created_at, updated_at)
    VALUES (v_org, p_low, 'Bordeaux', 'PER_PERSON_PER_NIGHT', 1.65, true, true, ts, ts);

    -- -------------------------------------------------------------------------
    -- 9. Distribution
    -- -------------------------------------------------------------------------
    -- Aucun appel Channex n'est nécessaire : le scanner lit la table de mapping.
    -- Une ligne en échec suffit à reproduire l'état fidèlement.
    INSERT INTO channex_property_mapping (id, organization_id, clenzy_property_id, channex_property_id,
                                          channex_room_type_id, channex_default_rate_plan_id, sync_status,
                                          last_sync_error, created_at, updated_at)
    VALUES (gen_random_uuid(), v_org, p_low, 'demo-channex-property', 'demo-room-type', 'demo-rate-plan',
            'error', 'Tarifs refusés par le canal : plan tarifaire inconnu (démo)', ts, ts);

    -- Site bilingue dont la page d'accueil n'existe qu'en français.
    INSERT INTO sites (organization_id, slug, name, status, default_locale, locales, created_at, updated_at)
    VALUES (v_org, 'demo-supervision-' || v_org, '[DÉMO] Site vitrine', 'PUBLISHED', 'fr', 'fr,en', ts, ts)
    RETURNING id INTO v_site;
    INSERT INTO site_pages (site_id, path, type, title, locale, status, sort_order, ai_generated, created_at, updated_at)
    VALUES (v_site, '/', 'HOME', 'Accueil', 'fr', 'PUBLISHED', 0, false, ts, ts);

    -- -------------------------------------------------------------------------
    -- 10. Deux promotions actives qui se recouvrent + benchmark marché
    -- -------------------------------------------------------------------------
    INSERT INTO rate_plans (organization_id, property_id, name, type, priority, nightly_price, currency,
                            start_date, end_date, is_active, created_at)
    VALUES (v_org, p_high, '[DÉMO] Réservez tôt', 'EARLY_BIRD', 10, 95.00, 'EUR', d, d + 120, true, ts),
           (v_org, p_high, '[DÉMO] Dernière minute', 'LAST_MINUTE', 10, 95.00, 'EUR', d, d + 120, true, ts);

    INSERT INTO market_data_snapshots (organization_id, area, country_code, source, snapshot_date, stay_month,
                                       adr, occupancy_pct, revpar, currency, sample_size, confidence, created_at)
    VALUES (NULL, 'Nice', 'FR', 'DEMO', d, to_char(d, 'YYYY-MM'), 240.00, 78.00, 187.20, 'EUR', 42, 0.80, ts);

    -- -------------------------------------------------------------------------
    -- 11. La supervision doit être active, sinon le scan répond « disabled »
    -- -------------------------------------------------------------------------
    INSERT INTO supervision_settings (organization_id, enabled, paused, daily_scan_budget, created_at, updated_at)
    VALUES (v_org, true, false, 200, ts, ts)
    ON CONFLICT (organization_id) DO UPDATE SET enabled = true, paused = false, updated_at = now();

    RAISE NOTICE 'Jeu de démonstration créé pour l''organisation % — 8 logements.', v_org;
END
$seed$;

-- Rappel des identifiants à scanner.
SELECT id, name, city
  FROM properties
 WHERE organization_id = current_setting('demo.org_id')::bigint
   AND name LIKE '[DÉMO]%'
 ORDER BY id;
