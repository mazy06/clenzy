-- =============================================================================
-- Vérification du jeu de démonstration — DEV / LOCAL
-- =============================================================================
--
-- Rejoue les CONDITIONS de déclenchement de chaque scanner directement en SQL,
-- sans lancer de scan. Permet de savoir ce qui sortira AVANT de cliquer
-- « Scanner », et de diagnostiquer une carte manquante sans lire les logs.
--
-- Colonne « attendu » = ce que le seed vise. Un écart signale soit un seed
-- incomplet, soit une règle dont la fenêtre calendaire est fermée aujourd'hui.
--
-- Usage :
--   docker exec -i clenzy-postgres-dev psql -U clenzy -d clenzy_dev \
--     -v org=2 -f - < scripts/dev/check-constellation-demo.sql
-- =============================================================================

\set ON_ERROR_STOP on
\if :{?org}
\else
  \set org 2
\endif

WITH params AS (
    SELECT :org::bigint AS org, current_date AS d
),
demo AS (
    SELECT p.id, p.name, p.city FROM properties p CROSS JOIN params
     WHERE p.organization_id = params.org AND p.name LIKE '[DÉMO]%'
),
rules AS (

SELECT 1 AS ord, 'Réputation · avis sans réponse' AS regle, 2 AS attendu, count(*) AS trouve
  FROM guest_reviews r, params WHERE r.organization_id = params.org AND r.host_response IS NULL

UNION ALL SELECT 2, 'Voyageur · livret à envoyer (J-1 avec livret publié)', 1, count(*)
  FROM reservations r CROSS JOIN params
  JOIN properties p ON p.id = r.property_id
 WHERE r.organization_id = params.org AND r.check_in = params.d + 1 AND r.status <> 'cancelled'
   AND EXISTS (SELECT 1 FROM welcome_guides g WHERE g.property_id = p.id AND g.published)
   AND NOT EXISTS (SELECT 1 FROM welcome_guide_tokens t WHERE t.reservation_id = r.id)

UNION ALL SELECT 3, 'Communication · J-1 sans instructions', 1, count(*)
  FROM reservations r CROSS JOIN params
 WHERE r.organization_id = params.org AND r.check_in = params.d + 1 AND r.status <> 'cancelled'
   AND NOT EXISTS (SELECT 1 FROM welcome_guides g WHERE g.property_id = r.property_id AND g.published)

UNION ALL SELECT 4, 'Communication · fiche client sans email', 1, count(*)
  FROM reservations r CROSS JOIN params
  LEFT JOIN guests g ON g.id = r.guest_id
 WHERE r.organization_id = params.org AND r.status <> 'cancelled'
   AND r.check_in BETWEEN params.d AND params.d + 3
   AND (g.id IS NULL OR g.email IS NULL OR btrim(g.email) = '')

UNION ALL SELECT 5, 'Communication · échec d''envoi voyageur', 1, count(*)
  FROM guest_message_log l CROSS JOIN params
 WHERE l.organization_id = params.org AND l.status = 'FAILED'
   AND l.template_id IS NOT NULL AND l.created_at >= now() - interval '7 days'

UNION ALL SELECT 6, 'Voyageur · demande d''avis (départ hier)', 1, count(*)
  FROM reservations r CROSS JOIN params
  JOIN guests g ON g.id = r.guest_id
 WHERE r.organization_id = params.org AND r.check_out = params.d - 1 AND r.status <> 'cancelled'
   AND g.email IS NOT NULL
   AND EXISTS (SELECT 1 FROM welcome_guides w WHERE w.property_id = r.property_id AND w.published)

UNION ALL SELECT 7, 'Exploitation · versement ménage en échec', 1, count(*)
  FROM housekeeper_payout_records h CROSS JOIN params
  JOIN interventions i ON i.id = h.intervention_id
 WHERE h.organization_id = params.org AND h.status IN ('FAILED', 'BLOCKED') AND i.assigned_user_id IS NOT NULL

UNION ALL SELECT 8, 'Conformité · fiches police à déposer', 2, count(*)
  FROM guest_declarations gd CROSS JOIN params
 WHERE gd.organization_id = params.org AND gd.status = 'COMPLETED' AND gd.submitted_to_provider = false

UNION ALL SELECT 9, 'Conformité · mandat non signé', 1, count(*)
  FROM management_contracts c CROSS JOIN params
 WHERE c.organization_id = params.org AND c.status = 'DRAFT'

UNION ALL SELECT 10, 'Conformité · licence qui expire', 1, count(*)
  FROM property_licenses l CROSS JOIN params
 WHERE l.organization_id = params.org AND l.expires_at IS NOT NULL
   AND l.expires_at - l.renewal_lead_days <= params.d

UNION ALL SELECT 11, 'Conformité · demandes RGPD reçues', 2, count(*)
  FROM privacy_requests pr CROSS JOIN params
 WHERE pr.organization_id = params.org AND pr.type = 'ERASURE' AND pr.status = 'RECEIVED'

UNION ALL SELECT 12, 'Revenus · biens éligibles au séjour minimum (>=60 % sur 30 j)', 2, count(*)
  FROM demo p CROSS JOIN params
 WHERE (SELECT count(*) FROM calendar_days c
         WHERE c.property_id = p.id AND c.status = 'BOOKED'
           AND c.date BETWEEN params.d AND params.d + 30) >= 18

UNION ALL SELECT 13, 'Revenus · promotions qui se cannibalisent', 1, count(DISTINCT eb.property_id)
  FROM rate_plans eb CROSS JOIN params
  JOIN rate_plans lm ON lm.property_id = eb.property_id AND lm.type = 'LAST_MINUTE' AND lm.is_active
 WHERE eb.organization_id = params.org AND eb.type = 'EARLY_BIRD' AND eb.is_active

UNION ALL SELECT 14, 'Croissance · promo dernière minute possible', 6, count(*)
  FROM demo p CROSS JOIN params
 WHERE (SELECT count(*) FROM calendar_days c
         WHERE c.property_id = p.id AND c.status = 'BOOKED'
           AND c.date BETWEEN params.d AND params.d + 7) <= 2
   AND NOT EXISTS (SELECT 1 FROM rate_plans rp
                    WHERE rp.property_id = p.id AND rp.type = 'LAST_MINUTE' AND rp.is_active)

UNION ALL SELECT 15, 'Revenus · benchmark marché du mois', 1, count(*)
  FROM market_data_snapshots m CROSS JOIN params
 WHERE m.stay_month = to_char(params.d, 'YYYY-MM') AND m.adr IS NOT NULL
   AND m.area IN (SELECT city FROM demo)

UNION ALL SELECT 16, 'Exploitation · batterie de serrure faible', 1, count(*)
  FROM smart_lock_devices s CROSS JOIN params
 WHERE s.organization_id = params.org AND s.battery_level IS NOT NULL AND s.battery_level <= 20

UNION ALL SELECT 17, 'Exploitation · maintenance préventive due', 1, count(*)
  FROM demo p CROSS JOIN params
  JOIN properties pr ON pr.id = p.id
 WHERE pr.created_at <= now() - interval '11 months'
   AND NOT EXISTS (SELECT 1 FROM interventions i
                    WHERE i.property_id = p.id AND i.status = 'COMPLETED'
                      AND i.type IN ('MAINTENANCE', 'PREVENTIVE_MAINTENANCE'))

UNION ALL SELECT 18, 'Exploitation · devis en attente d''arbitrage', 1, count(DISTINCT q.intervention_id)
  FROM service_quotes q CROSS JOIN params
  JOIN interventions i ON i.id = q.intervention_id
 WHERE q.organization_id = params.org AND q.status = 'RECEIVED'
   AND i.status IN ('PENDING', 'AWAITING_VALIDATION', 'IN_PROGRESS')

UNION ALL SELECT 19, 'Exploitation · stock sous le seuil', 2, count(*)
  FROM property_stock_items s CROSS JOIN params
 WHERE s.organization_id = params.org AND s.reorder_threshold > 0 AND s.quantity <= s.reorder_threshold

UNION ALL SELECT 20, 'Finance · incident pendant le séjour', 1, count(DISTINCT r.id)
  FROM reservations r CROSS JOIN params
  JOIN interventions i ON i.property_id = r.property_id
 WHERE r.organization_id = params.org AND r.check_out BETWEEN params.d - 3 AND params.d
   AND r.total_price > 0 AND i.type LIKE '%MAINTENANCE%'
   AND i.created_at >= r.check_in::timestamp AND i.created_at < r.check_out::timestamp

UNION ALL SELECT 21, 'Finance · caution retenable (dégât au départ)', 1, count(DISTINCT sd.id)
  FROM security_deposits sd CROSS JOIN params
  JOIN reservations r ON r.id = sd.reservation_id
  JOIN interventions i ON i.property_id = r.property_id
 WHERE sd.organization_id = params.org AND sd.status = 'HELD'
   AND i.created_at >= r.check_out::timestamp
   AND i.created_at < r.check_out::timestamp + interval '48 hours'
   AND coalesce(i.actual_cost, i.estimated_cost) > 0

UNION ALL SELECT 22, 'Propriétaire · versement en attente', 1, count(*)
  FROM owner_payouts o CROSS JOIN params
 WHERE o.organization_id = params.org AND o.status = 'PENDING' AND o.net_amount > 0

UNION ALL SELECT 23, 'Propriétaire · travaux à approuver (>= 300 EUR)', 1, count(*)
  FROM interventions i CROSS JOIN params
 WHERE i.organization_id = params.org AND i.type LIKE '%MAINTENANCE%' AND i.status = 'PENDING'
   AND coalesce(i.actual_cost, i.estimated_cost) >= 300
   AND i.created_at >= now() - interval '14 days'

UNION ALL SELECT 24, 'Synchronisation · surréservation', 1, count(*)
  FROM reservations r1, reservations r2 CROSS JOIN params
 WHERE r1.property_id = r2.property_id AND r1.id < r2.id
   AND r1.organization_id = params.org AND r2.organization_id = params.org
   AND r1.status <> 'cancelled' AND r2.status <> 'cancelled'
   AND r1.check_in < r2.check_out AND r2.check_in < r1.check_out AND r1.check_out > params.d

UNION ALL SELECT 25, 'Communication · conversation qui chauffe', 1, count(*)
  FROM conversations c CROSS JOIN params
 WHERE c.organization_id = params.org AND c.status = 'OPEN' AND c.assigned_to_keycloak_id IS NULL
   AND c.last_message_at >= now() - interval '30 minutes'
   AND (SELECT count(*) FROM conversation_messages m
         WHERE m.conversation_id = c.id AND m.direction = 'INBOUND'
           AND m.sent_at >= now() - interval '30 minutes') >= 3
   AND EXISTS (SELECT 1 FROM conversation_messages m
                WHERE m.conversation_id = c.id AND m.direction = 'INBOUND'
                  AND m.sent_at = c.last_message_at)

UNION ALL SELECT 26, 'Voyageur · relogement nécessaire', 1, count(DISTINCT r.id)
  FROM reservations r CROSS JOIN params
  JOIN interventions i ON i.property_id = r.property_id
 WHERE r.organization_id = params.org AND r.status = 'confirmed'
   AND r.check_in <= params.d + 1 AND r.check_out > params.d
   AND i.type LIKE '%MAINTENANCE%' AND upper(i.priority) = 'HIGH'
   AND i.status IN ('PENDING', 'AWAITING_VALIDATION', 'IN_PROGRESS')
   AND i.created_at >= now() - interval '72 hours'

UNION ALL SELECT 27, 'Synchronisation · no-show probable', 1, count(*)
  FROM reservations r CROSS JOIN params
 WHERE r.organization_id = params.org AND lower(r.status) = 'confirmed' AND r.no_show = false
   AND r.check_in <= params.d - 1 AND r.check_out > params.d
   AND NOT EXISTS (SELECT 1 FROM guest_declarations g WHERE g.reservation_id = r.id)
   AND NOT EXISTS (SELECT 1 FROM conversations c
                    JOIN conversation_messages m ON m.conversation_id = c.id
                   WHERE c.reservation_id = r.id AND m.direction = 'INBOUND'
                     AND m.sent_at >= r.check_in::timestamp)

UNION ALL SELECT 28, 'Messagerie · intentions classées exploitables', 3, count(*)
  FROM message_intents mi CROSS JOIN params
 WHERE mi.organization_id = params.org AND mi.confidence >= 0.75
   AND mi.created_at >= now() - interval '48 hours'

UNION ALL SELECT 29, 'Croissance · diffusion en erreur', 1, count(*)
  FROM channex_property_mapping cm CROSS JOIN params
 WHERE cm.organization_id = params.org AND cm.sync_status IN ('pending', 'error')

UNION ALL SELECT 30, 'Croissance · biens non diffusés', 7, count(*)
  FROM demo p
 WHERE NOT EXISTS (SELECT 1 FROM channex_property_mapping cm WHERE cm.clenzy_property_id = p.id)

UNION ALL SELECT 31, 'Croissance · page de site non traduite', 1, count(*)
  FROM sites s CROSS JOIN params
  JOIN site_pages sp ON sp.site_id = s.id AND sp.status = 'PUBLISHED'
 WHERE s.organization_id = params.org AND s.locales LIKE '%,%'
   AND (sp.locale IS NULL OR sp.locale = s.default_locale)
   AND NOT EXISTS (SELECT 1 FROM site_pages other
                    WHERE other.site_id = s.id AND other.path = sp.path
                      AND other.locale IS NOT NULL AND other.locale <> s.default_locale)
)
SELECT lpad(ord::text, 2) AS n,
       regle,
       attendu,
       trouve,
       CASE WHEN trouve >= attendu THEN 'OK' ELSE 'MANQUE' END AS etat
  FROM rules ORDER BY ord;

-- -----------------------------------------------------------------------------
-- Garde-fou : colonnes NULL que Hibernate refuse de lire
-- -----------------------------------------------------------------------------
-- Ces colonnes sont nullables en base, mais mappées sur un type PRIMITIF côté
-- Java. Une valeur NULL fait échouer le chargement de l'entité — donc un 500 sur
-- l'endpoint, et un écran vide, pour les données réelles comme pour la démo.
-- La liste est écrite en dur parce que la correspondance primitif/colonne
-- n'existe que dans le code Java, pas dans le schéma.
SELECT 'properties.maintenance_contract' AS colonne, count(*) AS nulls
  FROM properties WHERE organization_id = :org::bigint AND maintenance_contract IS NULL
UNION ALL SELECT 'properties.booking_engine_visible', count(*)
  FROM properties WHERE organization_id = :org::bigint AND booking_engine_visible IS NULL
UNION ALL SELECT 'properties.org_can_create_vouchers', count(*)
  FROM properties WHERE organization_id = :org::bigint AND org_can_create_vouchers IS NULL
UNION ALL SELECT 'reservations.no_show', count(*)
  FROM reservations WHERE organization_id = :org::bigint AND no_show IS NULL
UNION ALL SELECT 'service_requests.is_urgent', count(*)
  FROM service_requests WHERE organization_id = :org::bigint AND is_urgent IS NULL
UNION ALL SELECT 'conversations.unread / message_count', count(*)
  FROM conversations WHERE organization_id = :org::bigint AND (unread IS NULL OR message_count IS NULL)
UNION ALL SELECT 'guest_declarations.is_primary / submitted_to_provider', count(*)
  FROM guest_declarations WHERE organization_id = :org::bigint
   AND (is_primary IS NULL OR submitted_to_provider IS NULL)
UNION ALL SELECT 'upsell_offers.active / sort_order / diffusion', count(*)
  FROM upsell_offers WHERE organization_id = :org::bigint
   AND (active IS NULL OR sort_order IS NULL OR diffuse_on_livret IS NULL OR diffuse_on_booking IS NULL)
UNION ALL SELECT 'owner_payouts.retry_count', count(*)
  FROM owner_payouts WHERE organization_id = :org::bigint AND retry_count IS NULL
UNION ALL SELECT 'message_templates.is_active', count(*)
  FROM message_templates WHERE organization_id = :org::bigint AND is_active IS NULL
ORDER BY 2 DESC;

-- Occupation à venir sur 90 jours : c'est elle qui arbitre baisse / hausse /
-- ni l'un ni l'autre. Sous 55 % → baisse ; au-dessus de 85 % → hausse ;
-- entre les deux → aucune carte de prix, place aux constats.
SELECT p.name,
       (SELECT count(*) FROM calendar_days c
         WHERE c.property_id = p.id AND c.status <> 'AVAILABLE'
           AND c.date > current_date AND c.date <= current_date + 90) * 100 / 90 AS occupation_pct
  FROM properties p
 WHERE p.organization_id = :org::bigint AND p.name LIKE '[DÉMO]%'
 ORDER BY 2 DESC;
