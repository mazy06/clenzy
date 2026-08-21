-- Photos d'un signalement d'anomalie.
--
-- Le signalement decrivait l'anomalie par du texte seul : impossible de juger
-- une fuite ou un degat sans revenir sur place. Les octets vivent en BYTEA
-- comme les photos d'intervention, avec la meme porte de sortie vers le
-- stockage objet (storage_key non NULL apres migration).
CREATE TABLE issue_photos (
    id                BIGSERIAL PRIMARY KEY,
    issue_id          BIGINT       NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    organization_id   BIGINT       NOT NULL,
    storage_key       VARCHAR(500),
    original_filename VARCHAR(255),
    content_type      VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
    file_size         BIGINT,
    data              BYTEA,
    uploaded_by_id    BIGINT REFERENCES users (id),
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_issue_photos_issue ON issue_photos (issue_id);
CREATE INDEX idx_issue_photos_org ON issue_photos (organization_id);
