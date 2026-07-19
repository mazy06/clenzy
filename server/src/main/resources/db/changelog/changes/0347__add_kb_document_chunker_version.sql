-- Version de l'algorithme de chunking utilise a l'ingestion d'un document kb.
-- Permet de re-ingerer automatiquement les documents decoupes avec un ancien
-- algorithme (les chunks existants ne beneficient sinon jamais des ameliorations
-- de chunking tant que le CONTENU du doc ne change pas). 0 = chunker legacy.
ALTER TABLE kb_document ADD COLUMN chunker_version INT NOT NULL DEFAULT 0;
