-- Migration V8: Refactorisation de la table users pour l'architecture Keycloak
-- Date: 2025-08-26

-- 1. Sauvegarder les données importantes avant suppression
CREATE TEMP TABLE users_backup AS 
SELECT 
    id,
    keycloak_id,
    role,
    status,
    phone_number,
    profile_picture_url,
    email_verified,
    phone_verified,
    last_login,
    created_at,
    updated_at
FROM users 
WHERE keycloak_id IS NOT NULL AND keycloak_id != '';

-- 2. Supprimer les colonnes sensibles et redondantes
ALTER TABLE users DROP COLUMN IF EXISTS password;
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS first_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;

-- 3. Renommer keycloak_id en external_id pour plus de clarté
ALTER TABLE users RENAME COLUMN keycloak_id TO external_id;

-- 4. Ajouter une colonne pour le type de source d'identité
ALTER TABLE users ADD COLUMN identity_source VARCHAR(20) DEFAULT 'keycloak';

-- 5. Ajouter des contraintes de validation
ALTER TABLE users ADD CONSTRAINT chk_identity_source_valid CHECK (identity_source IN ('keycloak', 'cognito', 'local'));

-- 6. Ajouter des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id);
CREATE INDEX IF NOT EXISTS idx_users_identity_source ON users(identity_source);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 7. Ajouter des commentaires pour documenter la nouvelle structure
COMMENT ON TABLE users IS 'Table des utilisateurs avec données métier uniquement - l''identité est gérée par Keycloak';
COMMENT ON COLUMN users.external_id IS 'ID externe de l''utilisateur (Keycloak ID)';
COMMENT ON COLUMN users.identity_source IS 'Source de l''identité (keycloak, cognito, local)';
COMMENT ON COLUMN users.role IS 'Rôle métier de l''utilisateur';
COMMENT ON COLUMN users.status IS 'Statut métier de l''utilisateur';

-- 8. Vérifier qu'il n'y a pas d'utilisateurs orphelins
-- (utilisateurs sans external_id)
SELECT COUNT(*) as orphaned_users FROM users WHERE external_id IS NULL OR external_id = '';

-- 9. Nettoyer les utilisateurs orphelins si nécessaire
-- DELETE FROM users WHERE external_id IS NULL OR external_id = '';

-- 10. Vérifier la nouvelle structure
\d users;
