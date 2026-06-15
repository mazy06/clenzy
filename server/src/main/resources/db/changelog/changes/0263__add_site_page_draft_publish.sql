-- Draft / Live (2.7) : une page de site a un brouillon de travail (`blocks`, toujours editable)
-- et un instantane publie (`published_blocks`, servi au public). `blocks` != `published_blocks`
-- => modifications non publiees. La livraison publique (SSR) sert desormais `published_blocks`.
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS published_blocks TEXT;
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

-- Backfill : les pages existantes sont considerees publiees avec leur contenu courant
-- (aucune regression : ce qui etait servi via `blocks` reste servi via `published_blocks`).
UPDATE site_pages SET published_blocks = blocks, published_at = updated_at
  WHERE published_blocks IS NULL;
