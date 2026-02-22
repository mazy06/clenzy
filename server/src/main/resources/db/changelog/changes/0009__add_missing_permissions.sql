-- Migration V13: Ajout des permissions manquantes (contact et portfolios:manage)
-- Date: 2026-01-25

-- Ajout des permissions pour le contact
INSERT INTO permissions (name, description, module) VALUES
('contact:view', 'Voir les messages de contact', 'contact'),
('contact:send', 'Envoyer des messages de contact', 'contact'),
('contact:manage', 'Gérer les messages de contact', 'contact')
ON CONFLICT (name) DO NOTHING;

-- Ajout de la permission portfolios:manage (permission générale de gestion)
INSERT INTO permissions (name, description, module) VALUES
('portfolios:manage', 'Gérer les portefeuilles', 'portfolios')
ON CONFLICT (name) DO NOTHING;

-- Attribution des permissions contact au rôle ADMIN par défaut
INSERT INTO role_permissions (role_id, permission_id, is_active, is_default)
SELECT r.id, p.id, true, true
FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.name IN ('contact:view', 'contact:send', 'contact:manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Attribution de la permission portfolios:manage au rôle ADMIN par défaut
INSERT INTO role_permissions (role_id, permission_id, is_active, is_default)
SELECT r.id, p.id, true, true
FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.name = 'portfolios:manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Attribution des permissions contact au rôle MANAGER par défaut
INSERT INTO role_permissions (role_id, permission_id, is_active, is_default)
SELECT r.id, p.id, true, true
FROM roles r, permissions p
WHERE r.name = 'MANAGER' AND p.name IN ('contact:view', 'contact:send')
ON CONFLICT (role_id, permission_id) DO NOTHING;
