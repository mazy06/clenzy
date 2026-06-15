-- Médiathèque du Studio (2.1) : médias org-scopés référencés par les champs image des blocs.
-- Le binaire vit dans PhotoStorageService (S3 ou BYTEA) ; cette table = métadonnées + lien org.

CREATE TABLE media_assets (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    storage_key     VARCHAR(512) NOT NULL,
    content_type    VARCHAR(128) NOT NULL,
    file_name       VARCHAR(255),
    file_size       BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_assets_org ON media_assets(organization_id);
