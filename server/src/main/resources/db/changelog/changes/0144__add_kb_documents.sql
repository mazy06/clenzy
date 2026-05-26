-- ============================================================================
-- 0144 : Knowledge base (RAG) — documents + chunks vectorises
-- ----------------------------------------------------------------------------
-- Deux tables :
--   kb_document : metadonnees d'un doc ingere (source path, titre, langue,
--                 scope org). organization_id NULL = doc globale Clenzy (README,
--                 docs produit) ; non-NULL = doc specifique a une org.
--   kb_chunk    : decoupage du contenu en morceaux ~500 tokens avec leur
--                 embedding (vector(1024)). Index ivfflat pour recherche par
--                 similarite cosine.
--
-- Modele d'embedding : 1024 dimensions (Voyage AI voyage-3-lite par defaut,
-- OpenAI text-embedding-3-small avec dimensions=1024 en alternative).
-- ============================================================================

-- ─── kb_document ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_document (
    id BIGSERIAL PRIMARY KEY,
    source_path VARCHAR(500) NOT NULL,
    title VARCHAR(255),
    content TEXT,
    lang VARCHAR(10) DEFAULT 'fr',
    organization_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_kb_document_source_org UNIQUE (source_path, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_document_org
    ON kb_document (organization_id);

COMMENT ON TABLE kb_document IS
    'Documentation indexee pour le RAG de l''assistant. organization_id NULL = doc
    globale Clenzy (README, primer, articles produit) ; non-NULL = doc specifique
    a une org cliente.';
COMMENT ON COLUMN kb_document.source_path IS
    'Chemin / URL d''origine (ex: docs/onboarding.md, https://help.clenzy.fr/...).';

-- ─── kb_chunk ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_chunk (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES kb_document(id) ON DELETE CASCADE,
    chunk_idx INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1024),
    token_count INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_kb_chunk_doc_idx UNIQUE (document_id, chunk_idx)
);

CREATE INDEX IF NOT EXISTS idx_kb_chunk_document
    ON kb_chunk (document_id);

-- Index IVFFlat pour cosine similarity. Le param lists=100 est un compromis :
-- au-dela de quelques milliers de chunks, augmenter (rule of thumb : sqrt(rows)).
-- Pour les volumes initiaux (~quelques centaines de chunks) c'est largement OK.
CREATE INDEX IF NOT EXISTS idx_kb_chunk_embedding_cosine
    ON kb_chunk USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

COMMENT ON TABLE kb_chunk IS
    'Chunks de documents (~500 tokens chacun) avec leur embedding vector(1024).
    Recherche par cosine similarity via l''operateur <=> de pgvector.';
COMMENT ON COLUMN kb_chunk.embedding IS
    'Embedding 1024d. NULL si la generation a echoue (le chunk reste indexable
    en texte pour fallback fulltext eventuel).';
