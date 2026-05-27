-- ============================================================================
-- 0145 : Embedding pgvector sur assistant_memory (memory relevance selection)
-- ----------------------------------------------------------------------------
-- Contexte : avant ce changeset, le system prompt re-injectait les 30 memoires
-- les plus recentes. Avec un user prolifique, on perdait les memoires
-- pertinentes au profit des dernieres. Cette migration ajoute un embedding
-- vector(1024) par entree pour permettre une selection par similarite cosine
-- avec le dernier message user.
--
-- Provider embeddings : meme dimension que kb_chunk (1024d) — Voyage AI
-- voyage-3-lite par defaut, OpenAI text-embedding-3-small en alternative.
-- L'embedding est genere a chaque upsert via EmbeddingService et stocke en
-- meme temps que la cle/valeur. Une entree sans embedding (provider down) reste
-- accessible via la requete recence-only en fallback.
--
-- Index ivfflat avec lists=50 : on attend quelques centaines d'entrees par
-- user grand maximum — la formule rule-of-thumb sqrt(rows) reste a 50.
-- ============================================================================

ALTER TABLE assistant_memory
    ADD COLUMN IF NOT EXISTS embedding vector(1024);

CREATE INDEX IF NOT EXISTS idx_assistant_memory_embedding_cosine
    ON assistant_memory USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);

COMMENT ON COLUMN assistant_memory.embedding IS
    'Embedding 1024d de "key + value". NULL si la generation a echoue — l''entree reste accessible via la requete fallback findRecentByUser.';
