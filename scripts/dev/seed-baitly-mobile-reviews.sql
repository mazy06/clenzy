-- Fixtures fictives du catalogue mobile local, séparées des avis de missions.
-- Ce script DEV n'est pas une migration applicative Liquibase.
-- Exécution/export : rtk proxy python3 scripts/dev/seed-baitly-mobile-reviews.py
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'clenzy_dev' THEN
    RAISE EXCEPTION 'Les avis de démonstration Baitly sont réservés à clenzy_dev';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS baitly_demo;
-- Table de fixtures uniquement, sans entité JPA ni lien avec des utilisateurs réels.
CREATE TABLE IF NOT EXISTS baitly_demo.provider_reviews (
  id text PRIMARY KEY,
  provider_id bigint NOT NULL CHECK (provider_id BETWEEN -5 AND -1),
  client_name text NOT NULL,
  client_role text NOT NULL CHECK (client_role IN ('OWNER', 'CONCIERGE')),
  client_organization text,
  portrait_index integer NOT NULL CHECK (portrait_index BETWEEN 0 AND 5),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback text NOT NULL,
  service_label text NOT NULL,
  reviewed_on date NOT NULL,
  is_demo boolean NOT NULL DEFAULT true CHECK (is_demo)
);
INSERT INTO baitly_demo.provider_reviews
  (id, provider_id, client_name, client_role, client_organization, portrait_index, rating, feedback, service_label, reviewed_on)
VALUES
  ('baitly-demo-r01', -1, 'Salma El Idrissi', 'OWNER', NULL, 0, 5, 'Appartement prêt avant l’arrivée des voyageurs. La cuisine et les salles de bain étaient impeccables, avec des photos après le ménage.', 'Ménage de départ', '2026-10-04'),
  ('baitly-demo-r02', -1, 'Youssef Amrani', 'CONCIERGE', 'Maison Safran · Démo', 1, 4, 'Bonne coordination pour deux départs le même matin. Le linge a été livré propre et plié. Un léger retard, annoncé à temps.', 'Linge de maison', '2026-09-27'),
  ('baitly-demo-r03', -1, 'Claire Morel', 'OWNER', NULL, 2, 5, 'Équipe ponctuelle et attentive aux petits détails. Les consommables ont été signalés avant la prochaine réservation.', 'Ménage de départ', '2026-09-15'),
  ('baitly-demo-r04', -2, 'Mehdi Berrada', 'CONCIERGE', 'Riad Horizon · Démo', 3, 5, 'La piscine a été remise en service avant notre arrivée de groupe. Explications claires sur le traitement et le suivi de l’eau.', 'Entretien de piscine', '2026-10-02'),
  ('baitly-demo-r05', -2, 'Philippe Laurent', 'OWNER', NULL, 4, 4, 'Intervention soignée et bassin propre. J’aurais apprécié un compte rendu un peu plus détaillé sur les produits utilisés.', 'Entretien de piscine', '2026-09-22'),
  ('baitly-demo-r06', -2, 'Nadia Benali', 'OWNER', NULL, 5, 5, 'Le problème de filtration a été identifié rapidement. Le prestataire a pris le temps de me montrer les points à surveiller.', 'Entretien de piscine', '2026-09-08'),
  ('baitly-demo-r07', -3, 'Salma El Idrissi', 'OWNER', NULL, 0, 4, 'Taille des arbustes et remise en état de la terrasse très propres. Les déchets verts ont été évacués le jour même.', 'Entretien du jardin', '2026-10-01'),
  ('baitly-demo-r08', -3, 'Mehdi Berrada', 'CONCIERGE', 'Riad Horizon · Démo', 3, 3, 'Le travail est correct, mais une seconde visite a été nécessaire pour finir l’arrosage. La communication pourrait être plus régulière.', 'Entretien du jardin', '2026-09-19'),
  ('baitly-demo-r09', -4, 'Youssef Amrani', 'CONCIERGE', 'Maison Safran · Démo', 1, 5, 'Plusieurs petites réparations réglées en une visite. Le devis correspondait exactement au montant facturé.', 'Petits travaux', '2026-10-05'),
  ('baitly-demo-r10', -4, 'Claire Morel', 'OWNER', NULL, 2, 4, 'La fuite a été réparée proprement et le logement laissé en ordre. Le créneau a dû être décalé d’une journée.', 'Petits travaux', '2026-09-24'),
  ('baitly-demo-r11', -5, 'Nadia Benali', 'OWNER', NULL, 5, 5, 'Collecte pratique et linge rendu dans les délais. Les draps et serviettes étaient bien séparés par logement.', 'Collecte et lavage', '2026-10-03'),
  ('baitly-demo-r12', -5, 'Philippe Laurent', 'OWNER', NULL, 4, 4, 'Service fiable pour notre linge de maison. Une pièce manquante a été retrouvée et livrée le lendemain.', 'Collecte et lavage', '2026-09-18')
ON CONFLICT (id) DO UPDATE SET
  provider_id = EXCLUDED.provider_id, client_name = EXCLUDED.client_name,
  client_role = EXCLUDED.client_role, client_organization = EXCLUDED.client_organization,
  portrait_index = EXCLUDED.portrait_index, rating = EXCLUDED.rating,
  feedback = EXCLUDED.feedback, service_label = EXCLUDED.service_label,
  reviewed_on = EXCLUDED.reviewed_on;
-- Profils publics fictifs, sans lien avec les tables de logements réels.
CREATE TABLE IF NOT EXISTS baitly_demo.client_profiles (
  id text PRIMARY KEY CHECK (id LIKE 'baitly-demo-client-%'),
  payload jsonb NOT NULL CHECK ((payload ->> 'demo')::boolean IS TRUE)
);
INSERT INTO baitly_demo.client_profiles (id, payload)
SELECT 'baitly-demo-client-' || portrait_index,
  jsonb_build_object('id', 'baitly-demo-client-' || portrait_index, 'demo', true,
    'name', client_name, 'role', client_role, 'organization', client_organization,
    'portraitIndex', portrait_index, 'city', 'Marrakech',
    'networkPublished', true, 'seekingManagement', client_role = 'OWNER' AND portrait_index IN (0, 2, 5),
    'bio', CASE WHEN client_role = 'CONCIERGE'
      THEN 'Une équipe locale pour accueillir les voyageurs et prendre soin des maisons à Marrakech.'
      ELSE 'Des logements accueillants pour découvrir Marrakech, avec une attention particulière au confort et aux détails.' END,
    'managementServices', CASE WHEN client_role = 'CONCIERGE'
      THEN jsonb_build_array('LISTINGS', 'PRICING', 'GUESTS', 'CLEANING', 'MAINTENANCE', 'OWNER_REPORTING')
      ELSE '[]'::jsonb END,
    'managementFeePct', CASE WHEN client_role = 'CONCIERGE' THEN 18 ELSE NULL END,
    'bookingDomain', CASE portrait_index WHEN 0 THEN 'sejours-salma.example' WHEN 1 THEN 'maison-safran.example'
      WHEN 2 THEN 'escales-claire.example' WHEN 3 THEN 'riad-horizon.example'
      WHEN 4 THEN 'maison-philippe.example' ELSE 'sejours-nadia.example' END,
    'properties', jsonb_build_array(
      jsonb_build_object('id', 'baitly-demo-home-' || portrait_index || '-1',
        'name', CASE portrait_index WHEN 0 THEN 'Riad des Oliviers' WHEN 1 THEN 'Maison Safran'
          WHEN 2 THEN 'La Terrasse des Orangers' WHEN 3 THEN 'Riad Horizon'
          WHEN 4 THEN 'Le Patio Bleu' ELSE 'Maison des Jasmins' END,
        'type', 'RIAD', 'city', 'Marrakech', 'guests', 6, 'bedrooms', 3, 'bathrooms', 2, 'areaM2', 140,
        'description', 'Un patio lumineux, des chambres calmes et une terrasse pour profiter des soirées. Un pied-à-terre pour découvrir la médina.',
        'photos', jsonb_build_array('cleaning', 'pool', 'garden'),
        'amenities', jsonb_build_array('WIFI', 'POOL', 'TERRACE', 'AIR_CONDITIONING'),
        'performance', jsonb_build_array(
          jsonb_build_object('year', 2024, 'calendarNights', 365, 'bookedNights', 210 + portrait_index * 10),
          jsonb_build_object('year', 2025, 'calendarNights', 365, 'bookedNights', 280 + portrait_index * 12)),
        'guestReviews', jsonb_build_array(
          jsonb_build_object('id', 'guest-' || portrait_index || '-1', 'name', 'Camille R.', 'portraitIndex', 2, 'rating', 5,
            'date', '2026-09-28', 'comment', 'Très beau séjour. Le patio est calme, la literie confortable et l’accueil attentionné.'),
          jsonb_build_object('id', 'guest-' || portrait_index || '-2', 'name', 'Karim A.', 'portraitIndex', 1, 'rating', 4,
            'date', '2026-09-14', 'comment', 'Maison agréable et propre. La terrasse est un vrai plus. Quelques bruits de rue en journée.'))),
      jsonb_build_object('id', 'baitly-demo-home-' || portrait_index || '-2',
        'name', CASE portrait_index WHEN 0 THEN 'Suite Zellige' WHEN 1 THEN 'Le Studio Safran'
          WHEN 2 THEN 'Le Nid de la Médina' WHEN 3 THEN 'Suite Horizon'
          WHEN 4 THEN 'Appartement du Patio' ELSE 'Le Studio des Jasmins' END,
        'type', 'APARTMENT', 'city', 'Marrakech', 'guests', 2, 'bedrooms', 1, 'bathrooms', 1, 'areaM2', 58,
        'description', 'Un appartement chaleureux avec cuisine équipée et espace de repos. Idéal pour un séjour à deux.',
        'photos', jsonb_build_array('maintenance', 'cleaning', 'laundry'),
        'amenities', jsonb_build_array('WIFI', 'KITCHEN', 'AIR_CONDITIONING'),
        'performance', jsonb_build_array(
          jsonb_build_object('year', 2024, 'calendarNights', 365, 'bookedNights', 190 + portrait_index * 12),
          jsonb_build_object('year', 2025, 'calendarNights', 365, 'bookedNights', 220 + portrait_index * 14)),
        'guestReviews', jsonb_build_array(
          jsonb_build_object('id', 'guest-' || portrait_index || '-3', 'name', 'Léa M.', 'portraitIndex', 0, 'rating', 5,
            'date', '2026-09-30', 'comment', 'Arrivée facile et appartement très propre. Nous avons particulièrement apprécié le confort de la chambre.'),
          jsonb_build_object('id', 'guest-' || portrait_index || '-4', 'name', 'Thomas B.', 'portraitIndex', 4, 'rating', 4,
            'date', '2026-09-10', 'comment', 'Un logement pratique pour visiter Marrakech. Cuisine bien équipée et hôte disponible.')))))
FROM (SELECT DISTINCT portrait_index, client_name, client_role, client_organization
      FROM baitly_demo.provider_reviews) clients
ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload;
COMMIT;
