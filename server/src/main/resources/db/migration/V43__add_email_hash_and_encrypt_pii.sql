-- V43 : Ajout de la colonne email_hash pour les lookups post-chiffrement PII
-- Le chiffrement des colonnes email, first_name, last_name est gere au niveau JPA
-- (@Convert) de maniere progressive : les donnees existantes restent lisibles,
-- les nouvelles ecritures seront chiffrees. Un batch de migration chiffrera les anciennes.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);

-- Peupler email_hash pour les utilisateurs existants (SHA-256 du lowercase email)
-- Note: encode(digest(...), 'hex') est une fonction PostgreSQL native (pgcrypto non requis pour digest simple)
UPDATE users SET email_hash = encode(digest(lower(trim(email)), 'sha256'), 'hex')
WHERE email_hash IS NULL AND email IS NOT NULL;

-- Index unique pour les lookups par hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);
