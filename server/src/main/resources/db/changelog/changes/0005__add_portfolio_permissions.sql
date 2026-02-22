-- Migration V7: Ajout des permissions pour les portefeuilles
-- Date: 2024-12-19

-- Ajout des permissions pour les portefeuilles
INSERT INTO permissions (name, description, category) VALUES
('portfolios:view', 'Voir les portefeuilles', 'portfolios'),
('portfolios:create', 'Créer des portefeuilles', 'portfolios'),
('portfolios:edit', 'Modifier des portefeuilles', 'portfolios'),
('portfolios:delete', 'Supprimer des portefeuilles', 'portfolios'),
('portfolios:manage_clients', 'Gérer les clients des portefeuilles', 'portfolios'),
('portfolios:manage_team', 'Gérer les équipes des portefeuilles', 'portfolios');

-- Attribution des permissions aux rôles
-- ADMIN : toutes les permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.name LIKE 'portfolios:%';

-- MANAGER : permissions de gestion des portefeuilles (sauf suppression)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'MANAGER' AND p.name IN (
    'portfolios:view',
    'portfolios:create',
    'portfolios:edit',
    'portfolios:manage_clients',
    'portfolios:manage_team'
);

-- SUPERVISOR : permission de visualisation uniquement
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'SUPERVISOR' AND p.name = 'portfolios:view';
