-- Depot des justificatifs par un candidat qui n'a PAS encore de compte.
--
-- LE TROU : `provider_documents.user_id` est NOT NULL et refere `users`. Un
-- candidat de la place de marche n'a pas d'utilisateur — il n'en aura un qu'a
-- l'acceptation. Les pieces ne pouvaient donc etre deposees qu'APRES la
-- decision, alors que ce sont precisement elles qui permettent de decider.
-- L'equipe les recevait par mail, hors du produit et hors de toute retention.
--
-- CE QU'ON NE FAIT PAS : une seconde table de documents. Les pieces sont les
-- memes (Kbis, vigilance URSSAF, RC pro, identite), leur cycle de vie est le
-- meme, et le jour de l'acceptation la reprise doit etre un simple changement
-- de proprietaire — pas une recopie entre deux tables qui divergeraient.

ALTER TABLE provider_documents
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE provider_documents
    ADD COLUMN IF NOT EXISTS marketplace_provider_id BIGINT;

-- ON DELETE CASCADE : effacer une candidature efface ses pieces. C'est la
-- forme attendue d'une demande d'effacement RGPD tant que le dossier n'est pas
-- devenu un compte.
ALTER TABLE provider_documents
    DROP CONSTRAINT IF EXISTS fk_provider_documents_marketplace;
ALTER TABLE provider_documents
    ADD CONSTRAINT fk_provider_documents_marketplace
    FOREIGN KEY (marketplace_provider_id) REFERENCES marketplace_providers (id) ON DELETE CASCADE;

-- Un document a UN proprietaire : un utilisateur, ou une candidature, jamais
-- les deux ni aucun. Sans cette contrainte, une reprise ratee laisserait une
-- piece rattachee des deux cotes et comptee deux fois dans un dossier.
ALTER TABLE provider_documents
    DROP CONSTRAINT IF EXISTS ck_provider_documents_single_owner;
ALTER TABLE provider_documents
    ADD CONSTRAINT ck_provider_documents_single_owner
    CHECK (num_nonnulls(user_id, marketplace_provider_id) = 1);

CREATE INDEX IF NOT EXISTS idx_provider_documents_marketplace
    ON provider_documents (marketplace_provider_id);

COMMENT ON COLUMN provider_documents.marketplace_provider_id IS
  'Candidature proprietaire de la piece, tant qu''aucun compte n''existe. Exclusif avec user_id.';

-- Le jeton de depot.
--
-- STOCKE EN EMPREINTE, jamais en clair : la colonne est lue par tout ce qui
-- accede a la base, et un jeton en clair y serait un acces direct aux pieces
-- d'identite d'un candidat. Meme raison que pour `email_hash`.
--
-- IL EXPIRE : reunir un Kbis et une attestation de vigilance prend des jours,
-- pas des minutes ; il ne doit pas pour autant rester valable indefiniment.
ALTER TABLE marketplace_providers
    ADD COLUMN IF NOT EXISTS upload_token_hash       VARCHAR(64),
    ADD COLUMN IF NOT EXISTS upload_token_expires_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_provider_upload_token
    ON marketplace_providers (upload_token_hash) WHERE upload_token_hash IS NOT NULL;

COMMENT ON COLUMN marketplace_providers.upload_token_hash IS
  'Empreinte SHA-256 du jeton de depot. Le jeton en clair n''est montre qu''une fois, au candidat qui vient de postuler.';
