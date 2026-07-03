-- Migration V8: Refactorisation de la table users pour l'architecture Keycloak
-- Date: 2025-08-26
--
-- REVISION 2026-07 (chantier 0000-baseline, replay sur base vierge) :
-- ce fichier historique (applique en prod via changelog-sync, protege par
-- validCheckSum dans le master changelog) contenait des instructions qui
-- rendaient le changelog non rejouable sur une base vierge :
--   - `\d users;` : meta-commande psql, invalide via JDBC/Liquibase ;
--   - DROP COLUMN email / first_name / last_name : colonnes toujours portees
--     par l'entite User (elles avaient ete recreees par ddl-auto=update a
--     l'epoque) — les dropper casse 0039 (UPDATE ... WHERE email IS NOT NULL)
--     et la validation Hibernate finale ;
--   - RENAME keycloak_id -> external_id : la colonne keycloak_id avait ete
--     recreee par ddl-auto=update juste apres et est referencee par 0037+ et
--     par l'entite ; external_id n'existe plus dans le modele.
-- Ces instructions sont retirees : le fichier reflete l'etat EFFECTIF
-- (post ddl-auto=update) atteint par les environnements existants.

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

-- 4. Ajouter une colonne pour le type de source d'identité
ALTER TABLE users ADD COLUMN identity_source VARCHAR(20) DEFAULT 'keycloak';

-- 5. Ajouter des contraintes de validation
ALTER TABLE users ADD CONSTRAINT chk_identity_source_valid CHECK (identity_source IN ('keycloak', 'cognito', 'local'));

-- 6. Ajouter des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_identity_source ON users(identity_source);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 7. Ajouter des commentaires pour documenter la nouvelle structure
COMMENT ON TABLE users IS 'Table des utilisateurs avec données métier uniquement - l''identité est gérée par Keycloak';
COMMENT ON COLUMN users.keycloak_id IS 'ID externe de l''utilisateur (Keycloak ID)';
COMMENT ON COLUMN users.identity_source IS 'Source de l''identité (keycloak, cognito, local)';
COMMENT ON COLUMN users.role IS 'Rôle métier de l''utilisateur';
COMMENT ON COLUMN users.status IS 'Statut métier de l''utilisateur';
