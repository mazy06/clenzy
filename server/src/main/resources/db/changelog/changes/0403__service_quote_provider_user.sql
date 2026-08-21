-- Rattache un devis a l'intervenant qui l'a SOUMIS.
--
-- Jusqu'ici `provider_name` etait du texte libre : le devis modelisait « ce que
-- le gestionnaire a recu », pas « ce que l'intervenant a propose ». Impossible
-- donc de repondre a « quels sont MES devis ». Cette colonne cree ce lien.
--
-- NULL = devis saisi par un gestionnaire pour un prestataire externe, tel
-- qu'aujourd'hui. Les lignes existantes restent valides sans reprise.
ALTER TABLE service_quotes
    ADD COLUMN IF NOT EXISTS provider_user_id BIGINT;

-- Lecture chaude : « mes devis », toujours borne a l'organisation.
CREATE INDEX IF NOT EXISTS idx_service_quotes_provider_user
    ON service_quotes (provider_user_id, organization_id)
    WHERE provider_user_id IS NOT NULL;
