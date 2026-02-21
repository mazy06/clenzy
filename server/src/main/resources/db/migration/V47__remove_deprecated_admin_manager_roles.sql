-- ============================================================================
-- V47 : Suppression des anciens roles ADMIN et MANAGER (Phase 7 Keycloak)
-- ============================================================================
-- Les utilisateurs ont ete migres vers SUPER_ADMIN et SUPER_MANAGER dans
-- Keycloak. Les lignes restantes en base avec role = 'ADMIN' ou 'MANAGER'
-- sont migrées vers SUPER_ADMIN / SUPER_MANAGER par securite.
-- ============================================================================

-- 1. Migrer les eventuels utilisateurs restants avec les anciens roles
UPDATE users SET role = 'SUPER_ADMIN'   WHERE role = 'ADMIN';
UPDATE users SET role = 'SUPER_MANAGER' WHERE role = 'MANAGER';

-- 2. Mettre a jour la contrainte CHECK sur la colonne role (si elle existe)
-- La contrainte a ete creee par V45 et doit maintenant exclure ADMIN/MANAGER
DO $$
BEGIN
    -- Supprimer l'ancienne contrainte si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'users' AND constraint_name = 'users_role_check'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;

    -- Recreer sans ADMIN/MANAGER
    ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'TECHNICIAN',
                        'HOUSEKEEPER', 'SUPERVISOR', 'LAUNDRY', 'EXTERIOR_TECH'));
EXCEPTION
    WHEN undefined_object THEN NULL; -- Pas de contrainte a supprimer
END $$;

-- 3. Supprimer les role_permissions associees aux anciens roles
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE name IN ('ADMIN', 'MANAGER'));

-- 4. Supprimer les entrees ADMIN/MANAGER de la table roles
DELETE FROM roles WHERE name IN ('ADMIN', 'MANAGER');
