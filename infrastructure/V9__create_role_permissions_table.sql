-- Migration V9: Création de la table des permissions des rôles
-- Cette table stocke les permissions de chaque rôle de manière persistante

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    permission_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_name, permission_name)
);

-- Index pour optimiser les recherches par rôle
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_name);

-- Index pour optimiser les recherches par permission
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_name);

-- Table vide au départ - Aucune permission par défaut
-- L'utilisateur devra configurer ses permissions via l'interface "Roles & Permissions"
-- Cette approche garantit que toutes les permissions viennent de la base de données

-- Commentaire sur la table
COMMENT ON TABLE role_permissions IS 'Table stockant les permissions de chaque rôle de manière persistante';
COMMENT ON COLUMN role_permissions.role_name IS 'Nom du rôle (ADMIN, MANAGER, USER)';
COMMENT ON COLUMN role_permissions.permission_name IS 'Nom de la permission (ex: portfolios:manage)';
