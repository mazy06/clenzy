-- Migration V4: Création des tables de permissions
-- Date: 2025-08-25

-- Table des permissions disponibles
CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    module VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des rôles (pour référence)
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table d'association rôles-permissions (permissions par défaut)
CREATE TABLE IF NOT EXISTS role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- Table des permissions personnalisées par utilisateur
CREATE TABLE IF NOT EXISTS user_permissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    is_granted BOOLEAN DEFAULT true,
    is_custom BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, permission_id)
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);

-- Insertion des rôles existants
INSERT INTO roles (name, display_name, description) VALUES
    ('ADMIN', 'Administrateur', 'Accès complet à la plateforme'),
    ('MANAGER', 'Manager', 'Gestion des opérations et des équipes'),
    ('HOST', 'Hôte', 'Propriétaire de logements Airbnb'),
    ('TECHNICIAN', 'Technicien', 'Intervient pour la maintenance et réparations'),
    ('HOUSEKEEPER', 'Housekeeper', 'Effectue le nettoyage des logements'),
    ('SUPERVISOR', 'Superviseur', 'Gère une équipe de techniciens/housekeepers')
ON CONFLICT (name) DO NOTHING;

-- Insertion des permissions disponibles
INSERT INTO permissions (name, description, module) VALUES
    -- Dashboard
    ('dashboard:view', 'Accès au tableau de bord', 'dashboard'),
    
    -- Propriétés
    ('properties:view', 'Voir les propriétés', 'properties'),
    ('properties:create', 'Créer des propriétés', 'properties'),
    ('properties:edit', 'Modifier des propriétés', 'properties'),
    ('properties:delete', 'Supprimer des propriétés', 'properties'),
    
    -- Demandes de service
    ('service-requests:view', 'Voir les demandes de service', 'service-requests'),
    ('service-requests:create', 'Créer des demandes de service', 'service-requests'),
    ('service-requests:edit', 'Modifier des demandes de service', 'service-requests'),
    ('service-requests:delete', 'Supprimer des demandes de service', 'service-requests'),
    
    -- Interventions
    ('interventions:view', 'Voir les interventions', 'interventions'),
    ('interventions:create', 'Créer des interventions', 'interventions'),
    ('interventions:edit', 'Modifier des interventions', 'interventions'),
    ('interventions:delete', 'Supprimer des interventions', 'interventions'),
    
    -- Équipes
    ('teams:view', 'Voir les équipes', 'teams'),
    ('teams:create', 'Créer des équipes', 'teams'),
    ('teams:edit', 'Modifier des équipes', 'teams'),
    ('teams:delete', 'Supprimer des équipes', 'teams'),
    
    -- Paramètres
    ('settings:view', 'Voir les paramètres', 'settings'),
    ('settings:edit', 'Modifier les paramètres', 'settings'),
    
    -- Utilisateurs
    ('users:manage', 'Gérer les utilisateurs', 'users'),
    ('users:view', 'Voir les utilisateurs', 'users'),
    
    -- Rapports
    ('reports:view', 'Voir les rapports', 'reports')
ON CONFLICT (name) DO NOTHING;

-- Insertion des permissions par défaut pour chaque rôle
-- ADMIN (toutes les permissions)
INSERT INTO role_permissions (role_id, permission_id, is_default)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- MANAGER (toutes sauf suppression et gestion utilisateurs)
INSERT INTO role_permissions (role_id, permission_id, is_default)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'MANAGER' 
  AND p.name NOT IN ('properties:delete', 'service-requests:delete', 'interventions:delete', 'teams:delete', 'users:manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HOST (lecture et création limitée)
INSERT INTO role_permissions (role_id, permission_id, is_default)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'HOST' 
  AND p.name IN ('dashboard:view', 'properties:view', 'properties:create', 'properties:edit', 'service-requests:view', 'service-requests:create', 'interventions:view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- TECHNICIAN (interventions et équipes)
INSERT INTO role_permissions (role_id, permission_id, is_default)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'TECHNICIAN' 
  AND p.name IN ('dashboard:view', 'interventions:view', 'interventions:edit', 'teams:view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HOUSEKEEPER (interventions et équipes)
INSERT INTO role_permissions (role_id, permission_id, is_default)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'HOUSEKEEPER' 
  AND p.name IN ('dashboard:view', 'interventions:view', 'interventions:edit', 'teams:view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SUPERVISOR (interventions et équipes)
INSERT INTO role_permissions (role_id, permission_id, is_default)
SELECT r.id, p.id, true
FROM roles r, permissions p
WHERE r.name = 'SUPERVISOR' 
  AND p.name IN ('dashboard:view', 'interventions:view', 'interventions:edit', 'teams:view', 'teams:edit')
ON CONFLICT (role_id, permission_id) DO NOTHING;
