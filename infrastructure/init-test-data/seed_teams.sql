-- Script SQL pour alimenter la base de données avec des équipes de test
-- Date: 2025-01-27
-- Description: Crée 2 équipes (Housekeeper et Technician) avec leurs membres

-- =====================================================
-- CRÉATION DES ÉQUIPES
-- =====================================================

-- Équipe des Housekeepers
INSERT INTO teams (
    name,
    description,
    intervention_type,
    created_at,
    updated_at
) VALUES (
    'Équipe Nettoyage Premium',
    'Équipe spécialisée dans le nettoyage approfondi des logements Airbnb. 
     Intervient pour les nettoyages post-séjour, ménages de fond et préparations d''arrivée.',
    'CLEANING',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 day'
);

-- Équipe des Technicians
INSERT INTO teams (
    name,
    description,
    intervention_type,
    created_at,
    updated_at
) VALUES (
    'Équipe Maintenance Technique',
    'Équipe de techniciens qualifiés pour la maintenance préventive et corrective.
     Intervient pour les réparations, installations et dépannages d''urgence.',
    'MAINTENANCE',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '2 hours'
);

-- =====================================================
-- AJOUT DES MEMBRES AUX ÉQUIPES
-- =====================================================

-- Membres de l'équipe Housekeeper (Équipe Nettoyage Premium)
INSERT INTO team_members (
    team_id,
    user_id,
    role,
    created_at,
    updated_at
) VALUES 
-- Housekeeper 1 comme LEADER de l'équipe
(
    (SELECT id FROM teams WHERE name = 'Équipe Nettoyage Premium'),
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-housekeeper-001'),
    'LEADER',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 day'
),
-- Housekeeper 2 comme MEMBER de l'équipe
(
    (SELECT id FROM teams WHERE name = 'Équipe Nettoyage Premium'),
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-housekeeper-002'),
    'MEMBER',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '1 day'
);

-- Membres de l'équipe Technician (Équipe Maintenance Technique)
INSERT INTO team_members (
    team_id,
    user_id,
    role,
    created_at,
    updated_at
) VALUES 
-- Technician 1 comme LEADER de l'équipe
(
    (SELECT id FROM teams WHERE name = 'Équipe Maintenance Technique'),
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-technician-001'),
    'LEADER',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '2 hours'
),
-- Technician 2 comme MEMBER de l'équipe
(
    (SELECT id FROM teams WHERE name = 'Équipe Maintenance Technique'),
    (SELECT id FROM users WHERE keycloak_id = 'keycloak-technician-002'),
    'MEMBER',
    NOW() - INTERVAL '23 days',
    NOW() - INTERVAL '2 hours'
);

-- =====================================================
-- VÉRIFICATION DES DONNÉES INSÉRÉES
-- =====================================================

-- Afficher les équipes créées
SELECT 
    id,
    name,
    description,
    intervention_type,
    created_at
FROM teams 
ORDER BY created_at;

-- Afficher les membres des équipes avec leurs détails
SELECT 
    tm.id as member_id,
    t.name as team_name,
    t.intervention_type,
    u.first_name,
    u.last_name,
    u.email,
    u.role as user_role,
    tm.role as team_role,
    tm.created_at as joined_at
FROM team_members tm
JOIN teams t ON tm.team_id = t.id
JOIN users u ON tm.user_id = u.id
ORDER BY t.name, tm.role, u.first_name;

-- Statistiques des équipes
SELECT 
    t.name as team_name,
    t.intervention_type,
    COUNT(tm.id) as nombre_membres,
    COUNT(CASE WHEN tm.role = 'LEADER' THEN 1 END) as leaders,
    COUNT(CASE WHEN tm.role = 'MEMBER' THEN 1 END) as members
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
GROUP BY t.id, t.name, t.intervention_type
ORDER BY t.name;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================

/*
ÉQUIPES CRÉÉES:

1. Équipe Nettoyage Premium (CLEANING)
   - Leader: Housekeeper Un (housekeeper1@clenzy.fr)
   - Member: Housekeeper Deux (housekeeper2@clenzy.fr)

2. Équipe Maintenance Technique (MAINTENANCE)
   - Leader: Technician Un (technician1@clenzy.fr)
   - Member: Technician Deux (technician2@clenzy.fr)

RÔLES DANS LES ÉQUIPES:
- LEADER: Responsable de l'équipe, coordonne les interventions
- MEMBER: Membre actif de l'équipe, exécute les tâches

TYPES D'INTERVENTION:
- CLEANING: Nettoyage et ménage
- MAINTENANCE: Maintenance et réparations

TOTAL: 2 équipes avec 4 membres au total
*/
