-- Photos de l'emplacement exact d'un point de remise des cles.
--
-- Une adresse ne suffit pas a trouver une boite a cles (cour, digicode, boite
-- derriere un portail) ni le bon comptoir d'un commercant : le voyageur et
-- l'intervenant ont besoin de VOIR l'endroit. Les octets vivent sur le stockage
-- objet ; seule la cle est enregistree ici (pas de colonne BYTEA, table neuve).
CREATE TABLE key_exchange_point_photos (
    id                BIGSERIAL PRIMARY KEY,
    point_id          BIGINT       NOT NULL REFERENCES key_exchange_points (id) ON DELETE CASCADE,
    organization_id   BIGINT       NOT NULL,
    storage_key       VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255),
    content_type      VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
    file_size         BIGINT,
    uploaded_by_id    BIGINT REFERENCES users (id),
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kep_photos_point ON key_exchange_point_photos (point_id);
CREATE INDEX idx_kep_photos_org ON key_exchange_point_photos (organization_id);
