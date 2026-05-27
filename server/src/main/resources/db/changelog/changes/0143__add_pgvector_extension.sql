-- ============================================================================
-- 0143 : Extension pgvector pour le RAG (retrieval-augmented generation)
-- ----------------------------------------------------------------------------
-- Contexte : on stocke des embeddings (vecteurs 1024d) des docs Clenzy dans
-- la table kb_chunk pour permettre a l'assistant IA de citer la doc via une
-- recherche par similarite cosine.
--
-- PREREQUIS : l'image Postgres DOIT contenir pgvector. Le docker-compose.dev.yml
-- a ete bascule sur `pgvector/pgvector:pg15`. Si l'extension n'est pas
-- installee, ce changeset echouera au boot Liquibase — il faut alors mettre
-- a jour l'image et redemarrer le container postgres.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
