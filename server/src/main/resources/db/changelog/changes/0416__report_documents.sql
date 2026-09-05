-- Rapports d'analyse generes, figes et tracables.
--
-- POURQUOI UNE TABLE ET PAS UN RENDU A LA VOLEE : un rapport transmis a un
-- proprietaire ne doit jamais changer sous ses pieds. Si le document etait
-- recalcule a chaque ouverture, deux personnes discuteraient de deux documents
-- differents portant le meme numero — la meme raison qui fait qu'une facture
-- porte ses lignes plutot qu'une requete. `snapshot_json` porte donc TOUS les
-- chiffres du document au moment de sa generation ; le rendu (ecran ou PDF)
-- ne fait que le traduire.
--
-- `snapshot_hash` sert deux fins : detecter qu'une regeneration ne change rien
-- (inutile de repayer un commentaire IA identique) et prouver qu'un document
-- archive n'a pas ete retouche.
--
-- `narrative_json` est SEPARE du snapshot : les chiffres sont calcules, le
-- commentaire est genere. Les melanger empecherait de regenerer l'un sans
-- l'autre, et de servir un rapport quand l'agent est indisponible.
--
-- TEXT et non JSONB : ces colonnes ne sont jamais interrogees par leur contenu,
-- seulement lues en entier et deserialisees. JSONB paierait un cout de parsing
-- et de stockage pour une capacite inutilisee.
CREATE TABLE IF NOT EXISTS report_documents (
    id                       BIGSERIAL PRIMARY KEY,
    organization_id          BIGINT       NOT NULL,
    document_number          VARCHAR(32)  NOT NULL,
    version                  INTEGER      NOT NULL DEFAULT 1,
    profile                  VARCHAR(16)  NOT NULL,
    status                   VARCHAR(16)  NOT NULL DEFAULT 'DRAFT',
    title                    VARCHAR(200) NOT NULL,
    recipient_user_id        BIGINT,
    recipient_name           VARCHAR(200),
    recipient_email          VARCHAR(320),
    period_start             DATE         NOT NULL,
    period_end               DATE         NOT NULL,
    data_as_of               TIMESTAMPTZ  NOT NULL,
    snapshot_json            TEXT         NOT NULL,
    narrative_json           TEXT,
    snapshot_hash            VARCHAR(64)  NOT NULL,
    created_by_keycloak_id   VARCHAR(64),
    reviewed_at              TIMESTAMP,
    reviewed_by_keycloak_id  VARCHAR(64),
    sent_at                  TIMESTAMP,
    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_document_org
    ON report_documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_report_document_status
    ON report_documents (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_report_document_recipient
    ON report_documents (organization_id, recipient_user_id);

-- Le couple numero + version est unique PAR organisation : deux organisations
-- tirent leurs numeros independamment, et une reprise cree une version, jamais
-- un doublon silencieux.
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_document_number_version
    ON report_documents (organization_id, document_number, version);

COMMENT ON TABLE report_documents IS
  'Rapports d''analyse figes. snapshot_json porte tous les chiffres du document : le rendu ne recalcule rien.';
COMMENT ON COLUMN report_documents.snapshot_hash IS
  'Empreinte du snapshot : detecte une regeneration sans changement et prouve la non-retouche.';
COMMENT ON COLUMN report_documents.narrative_json IS
  'Commentaire de l''agent. Separe du snapshot : un rapport reste servable si l''agent est indisponible.';
