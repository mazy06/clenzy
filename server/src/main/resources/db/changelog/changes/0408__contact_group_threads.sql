-- Fils de discussion de GROUPE dans la messagerie de contact.
--
-- Un ContactMessage portait exactement un expediteur et un destinataire : les
-- « conversations » de l'ecran Contacts n'etaient qu'un regroupement par
-- interlocuteur, calcule a la volee. Impossible d'y reunir trois personnes —
-- un devis adresse a la fois au proprietaire et a la conciergerie donnait deux
-- echanges paralleles, chacun ignorant l'autre.
--
-- Un fil devient donc une entite, avec ses participants. Les messages un-a-un
-- restent inchanges : thread_id NULL = ancien comportement.

CREATE TABLE contact_threads (
    id                     BIGSERIAL PRIMARY KEY,
    organization_id        BIGINT       NOT NULL,
    subject                VARCHAR(255) NOT NULL,
    category               VARCHAR(20)  NOT NULL DEFAULT 'GENERAL',
    created_by_keycloak_id VARCHAR(100) NOT NULL,
    -- Objet metier a l'origine du fil (ex. SERVICE_QUOTE + id du devis) :
    -- permet de retrouver le fil existant plutot que d'en ouvrir un second.
    reference_type         VARCHAR(40),
    reference_id           BIGINT,
    last_message_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contact_threads_org ON contact_threads (organization_id, last_message_at DESC);
CREATE UNIQUE INDEX uq_contact_threads_reference
    ON contact_threads (organization_id, reference_type, reference_id)
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

CREATE TABLE contact_thread_participants (
    id           BIGSERIAL PRIMARY KEY,
    thread_id    BIGINT       NOT NULL REFERENCES contact_threads (id) ON DELETE CASCADE,
    keycloak_id  VARCHAR(100) NOT NULL,
    first_name   VARCHAR(100),
    last_name    VARCHAR(100),
    email        VARCHAR(255),
    archived     BOOLEAN      NOT NULL DEFAULT FALSE,
    last_read_at TIMESTAMP,
    joined_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_contact_thread_participant UNIQUE (thread_id, keycloak_id)
);

CREATE INDEX idx_contact_thread_participants_user ON contact_thread_participants (keycloak_id);

ALTER TABLE contact_messages ADD COLUMN thread_id BIGINT REFERENCES contact_threads (id) ON DELETE CASCADE;
CREATE INDEX idx_contact_messages_thread ON contact_messages (thread_id, created_at);

-- Un message de fil n'a plus UN destinataire : la visibilite vient de la
-- participation. Les colonnes restent, renseignees pour les echanges un-a-un.
ALTER TABLE contact_messages ALTER COLUMN recipient_keycloak_id DROP NOT NULL;
ALTER TABLE contact_messages ALTER COLUMN recipient_first_name DROP NOT NULL;
ALTER TABLE contact_messages ALTER COLUMN recipient_last_name DROP NOT NULL;
ALTER TABLE contact_messages ALTER COLUMN recipient_email DROP NOT NULL;
