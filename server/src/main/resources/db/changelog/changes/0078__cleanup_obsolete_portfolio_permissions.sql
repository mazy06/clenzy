-- Nettoyage des permissions portfolio obsoletes.
-- La migration 0005 (ex V7) avait cree des permissions granulaires :
--   portfolios:create, portfolios:edit, portfolios:delete,
--   portfolios:manage_clients, portfolios:manage_team
-- Le PermissionInitializer les a remplacees par :
--   portfolios:view, portfolios:manage, portfolios:manage_all
-- Les anciennes ne sont plus utilisees (frontend ni backend).

-- 1. Supprimer les associations role_permissions
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
