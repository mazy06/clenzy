-- ============================================================================
-- 0132 : Metadonnees booking importees depuis l'OTA (Phase 4)
-- ----------------------------------------------------------------------------
-- Contexte : Channex expose dans rate_plans[0].settings.* des champs qui
-- decrivent la politique de booking cote OTA mais qui n'avaient pas de
-- colonnes correspondantes cote Clenzy. Resultat : extraits dans
-- ChannelListingInfo puis perdus a l'import.
--
-- Cette migration ajoute 6 colonnes a properties pour ne plus rien perdre :
-- ============================================================================

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS maximum_nights INTEGER,
    ADD COLUMN IF NOT EXISTS cancellation_policy VARCHAR(60),
    ADD COLUMN IF NOT EXISTS instant_booking_policy VARCHAR(40),
    ADD COLUMN IF NOT EXISTS allows_pets BOOLEAN,
    ADD COLUMN IF NOT EXISTS allows_smoking BOOLEAN,
    ADD COLUMN IF NOT EXISTS allows_events BOOLEAN;

COMMENT ON COLUMN properties.maximum_nights IS
    'Max nuits par sejour (availability_rule.default_max_nights cote Airbnb).';
COMMENT ON COLUMN properties.cancellation_policy IS
    'Politique d annulation OTA (ex Airbnb: firm_14, moderate, strict, super_strict_30).';
COMMENT ON COLUMN properties.instant_booking_policy IS
    'Politique reservation instantanee (ex: everyone, experienced, off).';
COMMENT ON COLUMN properties.allows_pets IS
    'Animaux acceptes (NULL = non renseigne, true/false depuis OTA guest_controls).';
COMMENT ON COLUMN properties.allows_smoking IS
    'Fumeurs acceptes (NULL = non renseigne).';
COMMENT ON COLUMN properties.allows_events IS
    'Evenements acceptes (NULL = non renseigne).';
