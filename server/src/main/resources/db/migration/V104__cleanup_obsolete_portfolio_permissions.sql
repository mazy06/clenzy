-- Migration V104: Nettoyage des permissions portfolio obsoletes
-- Date: 2026-03-13
--
-- La migration V7 avait cree des permissions granulaires pour les portefeuilles
-- (portfolios:create, portfolios:edit, portfolios:delete, portfolios:manage_clients, portfolios:manage_team).
-- Le PermissionInitializer les a remplacees par un schema simplifie :
--   portfolios:view, portfolios:manage, portfolios:manage_all
-- Les anciennes permissions ne sont plus utilisees par le frontend ni le backend.

-- 1. Supprimer les associations role_permissions pour les permissions obsoletes
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE name IN (
        'portfolios:create',
        'portfolios:edit',
        'portfolios:delete',
        'portfolios:manage_clients',
        'portfolios:manage_team'
    )
);

-- 2. Supprimer les permissions obsoletes
DELETE FROM permissions
WHERE name IN (
    'portfolios:create',
    'portfolios:edit',
    'portfolios:delete',
    'portfolios:manage_clients',
    'portfolios:manage_team'
);
