-- Script SQL pour alimenter la base de données avec des utilisateurs de test
-- Date: 2025-01-27
-- Description: Crée des utilisateurs de test pour chaque rôle (sauf ADMIN qui existe déjà)
-- Mot de passe par défaut pour tous les utilisateurs de test: "password"

-- =====================================================
-- AJOUT DE LA COLONNE PASSWORD (si elle n'existe pas)
-- =====================================================

-- La colonne password existe déjà dans la structure actuelle

-- =====================================================
-- HASH DU MOT DE PASSE "password" (BCrypt)
-- =====================================================

-- Le hash BCrypt pour "password" est: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
-- Ceci correspond à "password" avec un coût de 10

-- =====================================================
-- UTILISATEURS MANAGER (2 utilisateurs)
-- =====================================================

INSERT INTO users (
    keycloak_id,
    role,
    status,
    phone_number,
    profile_picture_url,
    email_verified,
    phone_verified,
    last_login,
    created_at,
    updated_at,
    password,
    email,
    first_name,
    last_name
) VALUES (
    'keycloak-manager-001',
    'MANAGER',
    'ACTIVE',
    '+33123456789',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=manager1',
    true,
    true,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 day',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'manager1@clenzy.fr',
    'Manager',
    'Un'
), (
    'keycloak-manager-002',
    'MANAGER',
    'ACTIVE',
    '+33987654321',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=manager2',
    true,
    true,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '2 hours',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'manager2@clenzy.fr',
    'Manager',
    'Deux'
);

-- =====================================================
-- UTILISATEURS HOST (2 utilisateurs)
-- =====================================================

INSERT INTO users (
    keycloak_id,
    role,
    status,
    phone_number,
    profile_picture_url,
    email_verified,
    phone_verified,
    last_login,
    created_at,
    updated_at,
    password,
    email,
    first_name,
    last_name
) VALUES (
    'keycloak-host-001',
    'HOST',
    'ACTIVE',
    '+33111222333',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=host1',
    true,
    false,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '3 days',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'host1@clenzy.fr',
    'Host',
    'Un'
), (
    'keycloak-host-002',
    'HOST',
    'ACTIVE',
    '+33444555666',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=host2',
    true,
    true,
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '5 hours',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'host2@clenzy.fr',
    'Host',
    'Deux'
);

-- =====================================================
-- UTILISATEURS SUPERVISOR (2 utilisateurs)
-- =====================================================

INSERT INTO users (
    keycloak_id,
    role,
    status,
    phone_number,
    profile_picture_url,
    email_verified,
    phone_verified,
    last_login,
    created_at,
    updated_at,
    password,
    email,
    first_name,
    last_name
) VALUES (
    'keycloak-supervisor-001',
    'SUPERVISOR',
    'ACTIVE',
    '+33555666777',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=supervisor1',
    true,
    true,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '1 day',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'supervisor1@clenzy.fr',
    'Supervisor',
    'Un'
), (
    'keycloak-supervisor-002',
    'SUPERVISOR',
    'ACTIVE',
    '+33666777888',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=supervisor2',
    true,
    true,
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '12 hours',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'supervisor2@clenzy.fr',
    'Supervisor',
    'Deux'
);

-- =====================================================
-- UTILISATEURS TECHNICIAN (2 utilisateurs)
-- =====================================================

INSERT INTO users (
    keycloak_id,
    role,
    status,
    phone_number,
    profile_picture_url,
    email_verified,
    phone_verified,
    last_login,
    created_at,
    updated_at,
    password,
    email,
    first_name,
    last_name
) VALUES (
    'keycloak-technician-001',
    'TECHNICIAN',
    'ACTIVE',
    '+33777888999',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=technician1',
    true,
    true,
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '6 hours',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'technician1@clenzy.fr',
    'Technician',
    'Un'
), (
    'keycloak-technician-002',
    'TECHNICIAN',
    'ACTIVE',
    '+33888999000',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=technician2',
    true,
    false,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '2 days',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'technician2@clenzy.fr',
    'Technician',
    'Deux'
);

-- =====================================================
-- UTILISATEURS HOUSEKEEPER (2 utilisateurs)
-- =====================================================

INSERT INTO users (
    keycloak_id,
    role,
    status,
    phone_number,
    profile_picture_url,
    email_verified,
    phone_verified,
    last_login,
    created_at,
    updated_at,
    password,
    email,
    first_name,
    last_name
) VALUES (
    'keycloak-housekeeper-001',
    'HOUSEKEEPER',
    'ACTIVE',
    '+33999000111',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=housekeeper1',
    true,
    true,
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '50 days',
    NOW() - INTERVAL '4 hours',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'housekeeper1@clenzy.fr',
    'Housekeeper',
    'Un'
), (
    'keycloak-housekeeper-002',
    'HOUSEKEEPER',
    'ACTIVE',
    '+33111000222',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=housekeeper2',
    true,
    true,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '1 day',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'housekeeper2@clenzy.fr',
    'Housekeeper',
    'Deux'
);

-- =====================================================
-- MISE À JOUR DU MOT DE PASSE ADMIN EXISTANT
-- =====================================================

-- Mettre à jour le mot de passe de l'utilisateur admin existant
UPDATE users 
SET password = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
WHERE role = 'ADMIN';

-- =====================================================
-- VÉRIFICATION DES DONNÉES INSÉRÉES
-- =====================================================

-- Afficher le nombre d'utilisateurs par rôle
SELECT 
    role,
    COUNT(*) as nombre_utilisateurs,
    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as actifs,
    COUNT(CASE WHEN email_verified = true THEN 1 END) as emails_verifies,
    COUNT(CASE WHEN phone_verified = true THEN 1 END) as telephones_verifies
FROM users 
WHERE keycloak_id LIKE 'keycloak-%'
GROUP BY role
ORDER BY role;

-- Afficher tous les utilisateurs créés
SELECT 
    id,
    keycloak_id,
    role,
    status,
    email,
    first_name,
    last_name,
    phone_number,
    email_verified,
    phone_verified,
    last_login,
    created_at
FROM users 
WHERE keycloak_id LIKE 'keycloak-%'
ORDER BY role, id;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================

/*
IMPORTANT: Ce script crée des utilisateurs de test avec des keycloak_id factices.
Pour que ces utilisateurs fonctionnent avec Keycloak, vous devez :

1. Créer les utilisateurs correspondants dans Keycloak avec les mêmes keycloak_id
2. Ou modifier les keycloak_id pour correspondre aux vrais ID Keycloak
3. Ou utiliser des keycloak_id qui correspondent à des utilisateurs existants dans Keycloak

MOT DE PASSE UNIFORME:
- Tous les utilisateurs (y compris l'admin existant) ont le mot de passe: "password"
- Le hash BCrypt utilisé est: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
- Ceci facilite les tests et le développement

Les keycloak_id utilisés dans ce script sont :
- keycloak-manager-001, keycloak-manager-002
- keycloak-host-001, keycloak-host-002  
- keycloak-supervisor-001, keycloak-supervisor-002
- keycloak-technician-001, keycloak-technician-002
- keycloak-housekeeper-001, keycloak-housekeeper-002

Emails créés :
- manager1@clenzy.fr, manager2@clenzy.fr
- host1@clenzy.fr, host2@clenzy.fr
- supervisor1@clenzy.fr, supervisor2@clenzy.fr
- technician1@clenzy.fr, technician2@clenzy.fr
- housekeeper1@clenzy.fr, housekeeper2@clenzy.fr

Total: 10 utilisateurs de test (2 par rôle, sauf ADMIN)
+ 1 utilisateur admin existant mis à jour avec le même mot de passe
*/
