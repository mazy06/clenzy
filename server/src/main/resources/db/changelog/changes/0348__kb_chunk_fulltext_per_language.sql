-- Full-text par langue : la colonne content_tsv (0346) stemmait TOUT en config
-- 'french', y compris les corpus en/ar. Chaque chunk porte desormais la langue de
-- son document et sa tsvector est generee avec la config adaptee :
--   fr -> french, en -> english, ar -> simple (pas de stemmer arabe en Postgres,
--   'simple' = tokenisation + lowercase, suffisant pour le matching exact).
-- La requete (KbChunkRepository.searchByTextRank) applique la MEME config cote
-- websearch_to_tsquery selon la langue de l'utilisateur.

ALTER TABLE kb_chunk ADD COLUMN lang VARCHAR(10) NOT NULL DEFAULT 'fr';

UPDATE kb_chunk c
SET lang = COALESCE(d.lang, 'fr')
FROM kb_document d
WHERE d.id = c.document_id;

DROP INDEX IF EXISTS idx_kb_chunk_content_tsv;
ALTER TABLE kb_chunk DROP COLUMN content_tsv;

ALTER TABLE kb_chunk
    ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector(
        CASE lang
            WHEN 'en' THEN 'english'::regconfig
            WHEN 'ar' THEN 'simple'::regconfig
            ELSE 'french'::regconfig
        END, content)) STORED;

CREATE INDEX idx_kb_chunk_content_tsv ON kb_chunk USING GIN (content_tsv);
