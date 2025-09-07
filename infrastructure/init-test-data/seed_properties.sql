-- Script SQL pour alimenter la base de données avec des logements de test
-- Date: 2025-01-27
-- Description: Crée 9 logements répartis entre les utilisateurs HOST

-- =====================================================
-- LOGEMENTS POUR HOST 1 (host1@clenzy.fr)
-- =====================================================

-- Logement 1: Appartement moderne à Paris
INSERT INTO properties (
    name,
    description,
    type,
    status,
    address,
    city,
    postal_code,
    country,
    latitude,
    longitude,
    bedroom_count,
    bathroom_count,
    max_guests,
    square_meters,
    nightly_price,
    airbnb_listing_id,
    airbnb_url,
    cleaning_frequency,
    maintenance_contract,
    emergency_contact,
    emergency_phone,
    access_instructions,
    special_requirements,
    owner_id,
    created_at,
    updated_at
) VALUES (
    'Appartement moderne 2 pièces - Champs-Élysées',
    'Magnifique appartement rénové de 2 pièces situé à 5 minutes à pied des Champs-Élysées. 
     Entièrement équipé avec wifi, climatisation et lave-linge. Idéal pour un séjour professionnel ou touristique.',
    'APARTMENT',
    'ACTIVE',
    '15 Avenue des Champs-Élysées',
    'Paris',
    '75008',
    'France',
    48.8566,
    2.3522,
    1,
    1,
    2,
    45,
    120.00,
    'AIRBNB123456',
    'https://www.airbnb.fr/rooms/123456',
    'AFTER_EACH_STAY',
    true,
    'Marie Dubois',
    '+33123456789',
    'Code d''accès: 1234A. Clés dans la boîte aux lettres.',
    'Pas de fumeurs. Animaux non autorisés.',
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-host-001'),
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '2 days'
);

-- Logement 2: Studio cosy à Montmartre
INSERT INTO properties (
    name,
    description,
    type,
    status,
    address,
    city,
    postal_code,
    country,
    latitude,
    longitude,
    bedroom_count,
    bathroom_count,
    max_guests,
    square_meters,
    nightly_price,
    airbnb_listing_id,
    airbnb_url,
    cleaning_frequency,
    maintenance_contract,
    emergency_contact,
    emergency_phone,
    access_instructions,
    special_requirements,
    owner_id,
    created_at,
    updated_at
) VALUES (
    'Studio cosy avec vue sur Sacré-Cœur',
    'Charmant studio de 25m² avec une vue imprenable sur le Sacré-Cœur. 
     Parfait pour un couple en escapade romantique. Cuisine équipée et wifi inclus.',
    'STUDIO',
    'ACTIVE',
    '8 Rue de la Vieille-Lanterne',
    'Paris',
    '75018',
    'France',
    48.8867,
    2.3431,
    0,
    1,
    2,
    25,
    85.00,
    'AIRBNB123457',
    'https://www.airbnb.fr/rooms/123457',
    'AFTER_EACH_STAY',
    false,
    'Pierre Martin',
    '+33987654321',
    'RDC, porte à gauche. Clés sous le paillasson.',
    'Accès difficile pour personnes à mobilité réduite.',
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-host-001'),
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '1 week'
);

-- Logement 3: Villa de luxe à Nice
INSERT INTO properties (
    name,
    description,
    type,
    status,
    address,
    city,
    postal_code,
    country,
    latitude,
    longitude,
    bedroom_count,
    bathroom_count,
    max_guests,
    square_meters,
    nightly_price,
    airbnb_listing_id,
    airbnb_url,
    cleaning_frequency,
    maintenance_contract,
    emergency_contact,
    emergency_phone,
    access_instructions,
    special_requirements,
    owner_id,
    created_at,
    updated_at
) VALUES (
    'Villa de luxe avec piscine - Côte d''Azur',
    'Superbe villa de 200m² avec piscine privée et jardin paysager. 
     4 chambres, 3 salles de bain, cuisine moderne et terrasse panoramique sur la mer.',
    'VILLA',
    'ACTIVE',
    '45 Promenade des Anglais',
    'Nice',
    '06000',
    'France',
    43.7102,
    7.2620,
    4,
    3,
    8,
    200,
    350.00,
    'AIRBNB123458',
    'https://www.airbnb.fr/rooms/123458',
    'WEEKLY',
    true,
    'Sophie Laurent',
    '+33412345678',
    'Portail automatique. Code: 2024. Clés dans le coffre-fort.',
    'Piscine chauffée. Parking privé inclus.',
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-host-001'),
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '3 days'
);

-- Logement 4: Loft industriel à Lyon
INSERT INTO properties (
    name,
    description,
    type,
    status,
    address,
    city,
    postal_code,
    country,
    latitude,
    longitude,
    bedroom_count,
    bathroom_count,
    max_guests,
    square_meters,
    nightly_price,
    airbnb_listing_id,
    airbnb_url,
    cleaning_frequency,
    maintenance_contract,
    emergency_contact,
    emergency_phone,
    access_instructions,
    special_requirements,
    owner_id,
    created_at,
    updated_at
) VALUES (
    'Loft industriel rénové - Confluence',
    'Ancien entrepôt transformé en loft moderne de 80m². 
     Hauteur sous plafond de 4m, poutres apparentes, cuisine ouverte et terrasse privée.',
    'LOFT',
    'UNDER_MAINTENANCE',
    '12 Rue de la République',
    'Lyon',
    '69002',
    'France',
    45.7640,
    4.8357,
    1,
    1,
    4,
    80,
    95.00,
    'AIRBNB123459',
    'https://www.airbnb.fr/rooms/123459',
    'BIWEEKLY',
    true,
    'Antoine Moreau',
    '+33478901234',
    '3ème étage, ascenseur. Clés chez le gardien.',
    'Travaux en cours jusqu''au 15/02/2025.',
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-host-001'),
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '1 day'
);

-- Logement 5: Chalet de montagne à Chamonix
INSERT INTO properties (
    name,
    description,
    type,
    status,
    address,
    city,
    postal_code,
    country,
    latitude,
    longitude,
    bedroom_count,
    bathroom_count,
    max_guests,
    square_meters,
    nightly_price,
    airbnb_listing_id,
    airbnb_url,
    cleaning_frequency,
    maintenance_contract,
    emergency_contact,
    emergency_phone,
    access_instructions,
    special_requirements,
    owner_id,
    created_at,
    updated_at
) VALUES (
    'Chalet traditionnel - Mont-Blanc',
    'Authentique chalet de montagne de 120m² avec cheminée et vue sur le Mont-Blanc. 
     3 chambres, 2 salles de bain, garage et jardin. Idéal pour les amateurs de ski.',
    'CHALET',
    'ACTIVE',
    '25 Route du Mont-Blanc',
    'Chamonix-Mont-Blanc',
    '74400',
    'France',
    45.9237,
    6.8694,
    3,
    2,
    6,
    120,
    180.00,
    'AIRBNB123460',
    'https://www.airbnb.fr/rooms/123460',
    'ON_DEMAND',
    false,
    'Jean-Claude Blanc',
    '+33456789012',
    'Clés dans la boîte aux lettres. Code: CHALET2024',
    'Chauffage au bois. Parking extérieur.',
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-host-001'),
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '5 days'
);

-- =====================================================
-- LOGEMENTS POUR HOST 2 (host2@clenzy.fr)
-- =====================================================

-- Logement 6: Maison de ville à Bordeaux
INSERT INTO properties (
    name,
    description,
    type,
    status,
    address,
    city,
    postal_code,
    country,
    latitude,
    longitude,
    bedroom_count,
    bathroom_count,
    max_guests,
    square_meters,
    nightly_price,
    airbnb_listing_id,
    airbnb_url,
    cleaning_frequency,
    maintenance_contract,
    emergency_contact,
    emergency_phone,
    access_instructions,
    special_requirements,
    owner_id,
    created_at,
    updated_at
) VALUES (
    'Maison de ville historique - Centre-ville',
    'Belle maison de ville du XIXe siècle rénovée avec goût. 
     2 chambres, 1 salle de bain, jardin privé et terrasse. Proche des vignobles.',
    'HOUSE',
    'ACTIVE',
    '8 Rue Sainte-Catherine',
    'Bordeaux',
    '33000',
    'France',
    44.8378,
    -0.5792,
    2,
    1,
    4,
    90,
    110.00,
    'AIRBNB123461',
    'https://www.airbnb.fr/rooms/123461',
    'AFTER_EACH_STAY',
    true,
    'Isabelle Rousseau',
    '+33512345678',
    'Porte cochère. Clés dans le hall d''entrée.',
    'Jardin partagé avec les voisins.',
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-host-002'),
    NOW() - INTERVAL '50 days',
    NOW() - INTERVAL '1 week'
);

-- Logement 7: Appartement design à Marseille
INSERT INTO properties (
    name,
    description,
    type,
    status,
    address,
    city,
    postal_code,
    country,
    latitude,
    longitude,
    bedroom_count,
    bathroom_count,
    max_guests,
    square_meters,
    nightly_price,
    airbnb_listing_id,
    airbnb_url,
    cleaning_frequency,
    maintenance_contract,
    emergency_contact,
    emergency_phone,
    access_instructions,
    special_requirements,
    owner_id,
    created_at,
    updated_at
) VALUES (
    'Appartement design - Vieux-Port',
    'Appartement moderne de 60m² avec vue sur le Vieux-Port. 
     Décoration contemporaine, cuisine équipée et balcon privé. Proche des calanques.',
    'APARTMENT',
    'ACTIVE',
    '22 Quai du Port',
    'Marseille',
    '13002',
    'France',
    43.2965,
    5.3698,
    1,
    1,
    3,
    60,
    75.00,
    'AIRBNB123462',
    'https://www.airbnb.fr/rooms/123462',
    'WEEKLY',
    false,
    'Marc Provençal',
    '+33412345678',
    '2ème étage, interphone. Code: MARSEILLE',
    'Parking public à proximité.',
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-host-002'),
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '2 days'
);

-- Logement 8: Cottage rustique en Bretagne
INSERT INTO properties (
    name,
    description,
    type,
    status,
    address,
    city,
    postal_code,
    country,
    latitude,
    longitude,
    bedroom_count,
    bathroom_count,
    max_guests,
    square_meters,
    nightly_price,
    airbnb_listing_id,
    airbnb_url,
    cleaning_frequency,
    maintenance_contract,
    emergency_contact,
    emergency_phone,
    access_instructions,
    special_requirements,
    owner_id,
    created_at,
    updated_at
) VALUES (
    'Cottage breton - Côte de Granit Rose',
    'Charmant cottage de 70m² en pierre avec jardin fleuri. 
     2 chambres, 1 salle de bain, cheminée et terrasse. Vue sur la mer à 200m.',
    'COTTAGE',
    'ACTIVE',
    '15 Rue des Goélands',
    'Perros-Guirec',
    '22700',
    'France',
    48.8139,
    -3.4446,
    2,
    1,
    4,
    70,
    90.00,
    'AIRBNB123463',
    'https://www.airbnb.fr/rooms/123463',
    'BIWEEKLY',
    true,
    'Yann Le Breton',
    '+33212345678',
    'Clés sous le pot de fleurs. Code: BRETAGNE',
    'Chauffage électrique. Linge fourni.',
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-host-002'),
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '4 days'
);

-- Logement 9: Chambre d'hôte en Provence
INSERT INTO properties (
    name,
    description,
    type,
    status,
    address,
    city,
    postal_code,
    country,
    latitude,
    longitude,
    bedroom_count,
    bathroom_count,
    max_guests,
    square_meters,
    nightly_price,
    airbnb_listing_id,
    airbnb_url,
    cleaning_frequency,
    maintenance_contract,
    emergency_contact,
    emergency_phone,
    access_instructions,
    special_requirements,
    owner_id,
    created_at,
    updated_at
) VALUES (
    'Chambre d''hôte - Lavande et Soleil',
    'Chambre d''hôte de charme dans une bastide provençale. 
     Chambre privée avec salle de bain, petit-déjeuner inclus. Jardin avec piscine.',
    'GUEST_ROOM',
    'INACTIVE',
    '5 Chemin des Lavandes',
    'Aix-en-Provence',
    '13100',
    'France',
    43.5297,
    5.4474,
    1,
    1,
    2,
    25,
    65.00,
    'AIRBNB123464',
    'https://www.airbnb.fr/rooms/123464',
    'AFTER_EACH_STAY',
    false,
    'Claire Provençale',
    '+33412345678',
    'Entrée principale. Sonner à "Chambre d''hôte".',
    'Petit-déjeuner servi de 8h à 10h.',
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-host-002'),
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '1 day'
);

-- =====================================================
-- VÉRIFICATION DES DONNÉES INSÉRÉES
-- =====================================================

-- Afficher les logements créés avec leurs propriétaires
SELECT 
    p.id,
    p.name,
    p.type,
    p.status,
    p.city,
    p.bedroom_count,
    p.bathroom_count,
    p.max_guests,
    p.nightly_price,
    p.cleaning_frequency,
    u.first_name as owner_first_name,
    u.last_name as owner_last_name,
    u.email as owner_email,
    p.created_at
FROM properties p
JOIN users u ON p.owner_id = u.id
WHERE u.keycloak_id LIKE 'keycloak-host-%'
ORDER BY u.keycloak_id, p.created_at;

-- Statistiques par propriétaire
SELECT 
    u.first_name || ' ' || u.last_name as owner_name,
    u.email as owner_email,
    COUNT(p.id) as nombre_logements,
    COUNT(CASE WHEN p.status = 'ACTIVE' THEN 1 END) as actifs,
    COUNT(CASE WHEN p.status = 'INACTIVE' THEN 1 END) as inactifs,
    COUNT(CASE WHEN p.status = 'UNDER_MAINTENANCE' THEN 1 END) as en_maintenance,
    ROUND(AVG(p.nightly_price), 2) as prix_moyen_nuit,
    SUM(p.square_meters) as surface_totale
FROM properties p
JOIN users u ON p.owner_id = u.id
WHERE u.keycloak_id LIKE 'keycloak-host-%'
GROUP BY u.id, u.first_name, u.last_name, u.email
ORDER BY u.first_name;

-- Statistiques par type de logement
SELECT 
    type,
    COUNT(*) as nombre,
    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as actifs,
    ROUND(AVG(nightly_price), 2) as prix_moyen,
    ROUND(AVG(square_meters), 0) as surface_moyenne
FROM properties 
WHERE owner_id IN (SELECT id FROM users WHERE keycloak_id LIKE 'keycloak-host-%')
GROUP BY type
ORDER BY nombre DESC;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================

/*
LOGEMENTS CRÉÉS:

HOST 1 (host1@clenzy.fr) - 5 logements:
1. Appartement moderne 2 pièces - Paris (Champs-Élysées) - 120€/nuit
2. Studio cosy - Paris (Montmartre) - 85€/nuit  
3. Villa de luxe avec piscine - Nice - 350€/nuit
4. Loft industriel rénové - Lyon - 95€/nuit (EN MAINTENANCE)
5. Chalet traditionnel - Chamonix - 180€/nuit

HOST 2 (host2@clenzy.fr) - 4 logements:
6. Maison de ville historique - Bordeaux - 110€/nuit
7. Appartement design - Marseille (Vieux-Port) - 75€/nuit
8. Cottage breton - Perros-Guirec - 90€/nuit
9. Chambre d'hôte - Aix-en-Provence - 65€/nuit (INACTIF)

TYPES DE LOGEMENTS:
- APARTMENT: 2 logements
- STUDIO: 1 logement
- VILLA: 1 logement
- LOFT: 1 logement
- CHALET: 1 logement
- HOUSE: 1 logement
- COTTAGE: 1 logement
- GUEST_ROOM: 1 logement

STATUTS:
- ACTIVE: 7 logements
- INACTIVE: 1 logement
- UNDER_MAINTENANCE: 1 logement

FRÉQUENCES DE NETTOYAGE:
- AFTER_EACH_STAY: 4 logements
- WEEKLY: 2 logements
- BIWEEKLY: 2 logements
- ON_DEMAND: 1 logement

TOTAL: 9 logements répartis entre 2 propriétaires HOST
*/
