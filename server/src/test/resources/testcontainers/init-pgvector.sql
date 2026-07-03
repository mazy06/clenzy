-- Testcontainers init script (socle IT) : les entites RAG (kb_chunk,
-- assistant_memory) declarent des colonnes vector(1024) — l'extension doit
-- exister AVANT le create-drop Hibernate.
CREATE EXTENSION IF NOT EXISTS vector;
