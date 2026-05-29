-- Stockage unifie pour les assets binaires (avatars users, fichiers contacts, etc.)
-- avec backend Postgres BYTEA. Une abstraction `BinaryAssetStorage` permet de
-- switcher vers S3 sans toucher au code applicatif (cf. CLAUDE.md "Storage strategy").
--
-- TODO MIGRATION S3 (quand on passera sous AWS) :
--   1. Implementer S3BinaryAssetStorage (cf. S3PhotoStorageService comme reference)
--   2. Activer via clenzy.storage.binary-assets=s3
--   3. Optionnel : migrer les bytes existants vers S3 puis vider la colonne bytes
--   4. Garder la table pour les metadonnees (content_type, file_size, key) et
--      laisser le storage_key pointer vers l'objet S3
--
-- Pour l'instant : tous les assets binaires Clenzy (user avatars en V1, contact
-- files et property photos en V2 quand on migrera) passent par cette table.

CREATE TABLE binary_asset (
    id BIGSERIAL PRIMARY KEY,
    -- Cle logique de l'asset. Convention : "<type>/<owner_id>/<uuid>.<ext>"
    -- Ex: "users/1/9b3c-...png". Unique pour permettre upsert idempotent.
    storage_key VARCHAR(512) NOT NULL UNIQUE,
    content_type VARCHAR(128) NOT NULL,
    file_size BIGINT NOT NULL,
    bytes BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_binary_asset_storage_key ON binary_asset(storage_key);
-- Index sur created_at pour les eventuels jobs de retention/archivage futurs.
CREATE INDEX idx_binary_asset_created_at ON binary_asset(created_at);

COMMENT ON TABLE binary_asset IS 'Stockage Postgres BYTEA pour assets binaires (avatars, fichiers contacts). Migration future vers S3 prevue via abstraction BinaryAssetStorage.';
COMMENT ON COLUMN binary_asset.storage_key IS 'Cle logique de l''asset, ex: users/42/abc-123.png';
