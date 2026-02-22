-- Migration V14: Ajout des permissions supplémentaires pour les rapports
-- Date: 2026-01-25

-- Ajout des permissions supplémentaires pour les rapports
INSERT INTO permissions (name, description, module) VALUES
('reports:generate', 'Générer des rapports', 'reports'),
('reports:download', 'Télécharger des rapports', 'reports'),
('reports:manage', 'Gérer les rapports (admin)', 'reports')
ON CONFLICT (name) DO NOTHING;

-- Attribution des permissions reports au rôle ADMIN par défaut
INSERT INTO role_permissions (role_id, permission_id, is_active, is_default)
SELECT r.id, p.id, true, true
FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.name IN ('reports:view', 'reports:generate', 'reports:download', 'reports:manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Attribution des permissions reports au rôle MANAGER par défaut (sauf manage)
INSERT INTO role_permissions (role_id, permission_id, is_active, is_default)
SELECT r.id, p.id, true, true
FROM roles r, permissions p
WHERE r.name = 'MANAGER' AND p.name IN ('reports:view', 'reports:generate', 'reports:download')
ON CONFLICT (role_id, permission_id) DO NOTHING;
