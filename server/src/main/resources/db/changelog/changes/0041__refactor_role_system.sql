-- ============================================================================
-- V45: Refactoring du systeme de roles — 3 couches
-- ============================================================================
-- Contexte :
--   - UserRole (plateforme) : ADMIN → SUPER_ADMIN, MANAGER → SUPER_MANAGER
--   - OrgMemberRole : enrichi avec MANAGER, SUPERVISOR, HOUSEKEEPER, etc.
--   - Nouveaux roles metier : LAUNDRY, EXTERIOR_TECH
--
-- Le PermissionInitializer au demarrage creera automatiquement les nouvelles
-- entrees dans la table `roles` pour les valeurs ajoutees dans UserRole.
-- Cette migration renomme les users existants et copie les permissions.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Renommer les roles plateforme dans la table users
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE users SET role = 'SUPER_ADMIN' WHERE role = 'ADMIN';
UPDATE users SET role = 'SUPER_MANAGER' WHERE role = 'MANAGER';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Elargir la colonne role_in_org pour accueillir les nouveaux noms
--    (VARCHAR(20) peut etre trop court pour 'EXTERIOR_TECH')
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE organization_members ALTER COLUMN role_in_org TYPE VARCHAR(30);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Elargir la colonne role de invitations si elle existe
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE invitations ALTER COLUMN role_invited TYPE VARCHAR(30);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Verification
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- Verifier qu'il n'y a plus d'ADMIN/MANAGER dans users.role
    IF EXISTS (SELECT 1 FROM users WHERE role = 'ADMIN') THEN
        RAISE EXCEPTION 'V45: Des users ont encore role=ADMIN apres migration';
    END IF;
    IF EXISTS (SELECT 1 FROM users WHERE role = 'MANAGER') THEN
        RAISE EXCEPTION 'V45: Des users ont encore role=MANAGER apres migration';
    END IF;
END $$;
