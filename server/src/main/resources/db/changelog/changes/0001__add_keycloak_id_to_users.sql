-- Migration V2: Ajout du champ keycloak_id à la table users
-- Date: 2024-01-XX
-- Description: Ajoute un champ pour lier les utilisateurs à leurs comptes Keycloak

-- Ajouter le champ keycloak_id
ALTER TABLE users ADD COLUMN keycloak_id VARCHAR(255);

-- Créer un index unique sur keycloak_id pour éviter les doublons
CREATE UNIQUE INDEX idx_users_keycloak_id ON users(keycloak_id);

-- Ajouter une contrainte pour permettre la valeur NULL (pour les utilisateurs existants)
ALTER TABLE users ALTER COLUMN keycloak_id DROP NOT NULL;

-- Commentaire sur la colonne
COMMENT ON COLUMN users.keycloak_id IS 'Identifiant unique de l''utilisateur dans Keycloak pour la synchronisation';
