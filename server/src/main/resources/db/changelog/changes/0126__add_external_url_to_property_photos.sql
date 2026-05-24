-- Ajoute le champ external_url a property_photos pour stocker les URLs photos
-- externes (Airbnb, Booking, etc.) recuperees via Channex sans avoir a telecharger
-- les bytes en local.
--
-- Cas d'usage : ChannexImportService cree des PropertyPhoto pour chaque photo
-- detectee dans content.photos[] d'une property Channex. On stocke juste l'URL
-- (1 ligne en DB) plutot que de telecharger des Mo d'images.
--
-- Le getter PropertyPhoto.getUrl() priorise external_url si present, sinon
-- retourne le chemin storage local (pour les photos uploadees manuellement).

ALTER TABLE property_photos
    ADD COLUMN IF NOT EXISTS external_url VARCHAR(2048);

COMMENT ON COLUMN property_photos.external_url IS
    'URL externe vers la photo originale (Airbnb, Booking via Channex). Null si photo stockee localement en bytea.';

-- Index pour les requetes de detection des photos importees vs locales
CREATE INDEX IF NOT EXISTS idx_property_photos_external_url
    ON property_photos (property_id) WHERE external_url IS NOT NULL;
