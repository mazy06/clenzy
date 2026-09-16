-- Demande de devis : la mise en relation entre une organisation et un prestataire.
--
-- POURQUOI ELLE EXISTE : le catalogue ne publie AUCUNE coordonnee. Sans ce
-- chemin, une conciergerie qui trouve le bon prestataire n'a aucun moyen de le
-- joindre — et un catalogue qui donnerait l'adresse de chacun serait un annuaire
-- de prospection. La demande de devis est le seul pont, et il est trace : les
-- deux parties savent qui a contacte qui, et quand.
--
-- TABLE PLATEFORME, SANS FILTRE TENANT. C'est le point qui compte : une demande
-- relie DEUX organisations — celle qui demande, et celle qui porte le
-- prestataire. Un filtre `organization_id = :orgId` n'en montrerait qu'une, et
-- le prestataire ne verrait jamais les demandes qui lui sont adressees. Le
-- controle d'acces est donc EXPLICITE des deux cotes, dans le service.
--
-- LE MONTANT APPARTIENT AU PRESTATAIRE. Les colonnes de reponse sont separees de
-- celles de la demande, et rien de ce que le demandeur envoie ne peut fixer un
-- prix. C'est la regle n°1 de l'audit : ne jamais faire confiance a un montant
-- venant du client.

CREATE TABLE IF NOT EXISTS marketplace_quote_requests (
    id                        BIGSERIAL PRIMARY KEY,

    -- ─── La demande ──────────────────────────────────────────────────────────
    marketplace_provider_id   BIGINT        NOT NULL,
    requester_organization_id BIGINT        NOT NULL,
    requested_by_user_id      BIGINT,
    -- Logement concerne, quand il y en a un. Une demande peut etre generale
    -- (« quels sont vos tarifs ? ») : le lien reste facultatif.
    property_id               BIGINT,
    category_code             VARCHAR(40),
    service_item_code         VARCHAR(60),
    title                     VARCHAR(150)  NOT NULL,
    message                   TEXT,
    desired_date              DATE,

    status                    VARCHAR(20)   NOT NULL DEFAULT 'SENT',

    -- ─── La reponse, ecrite par le PRESTATAIRE seul ─────────────────────────
    quoted_amount             NUMERIC(12,2),
    quoted_currency           VARCHAR(3),
    quote_message             TEXT,
    quote_valid_until         DATE,
    quoted_at                 TIMESTAMP,

    -- ─── La decision, ecrite par le DEMANDEUR seul ──────────────────────────
    decided_at                TIMESTAMP,
    decision_reason           VARCHAR(500),
    -- Intervention creee a l'acceptation. Vide tant que rien n'est accepte.
    intervention_id           BIGINT,

    created_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_quote_provider FOREIGN KEY (marketplace_provider_id)
        REFERENCES marketplace_providers (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quote_provider
    ON marketplace_quote_requests (marketplace_provider_id, status);
CREATE INDEX IF NOT EXISTS idx_quote_requester
    ON marketplace_quote_requests (requester_organization_id, status);
CREATE INDEX IF NOT EXISTS idx_quote_property
    ON marketplace_quote_requests (property_id) WHERE property_id IS NOT NULL;

COMMENT ON TABLE marketplace_quote_requests IS
  'Demandes de devis entre une organisation et un prestataire. Table PLATEFORME : elle relie deux organisations, aucun filtre tenant ne peut la borner.';
COMMENT ON COLUMN marketplace_quote_requests.quoted_amount IS
  'Montant fixe par le PRESTATAIRE. Aucune valeur venant du demandeur ne l''alimente.';
