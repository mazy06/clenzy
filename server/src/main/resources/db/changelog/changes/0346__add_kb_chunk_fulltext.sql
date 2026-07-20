-- Recherche hybride knowledge base : la recherche purement vectorielle rate les
-- requetes par termes exacts (« taxe de sejour », « iCal », noms de features).
-- On ajoute la partie lexicale : colonne tsvector generee (config french, le
-- corpus et les requetes assistant sont en francais) + index GIN.
-- La fusion vectoriel + lexical (RRF) se fait dans KbSearchService.

ALTER TABLE kb_chunk
    ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('french', content)) STORED;

CREATE INDEX idx_kb_chunk_content_tsv ON kb_chunk USING GIN (content_tsv);
