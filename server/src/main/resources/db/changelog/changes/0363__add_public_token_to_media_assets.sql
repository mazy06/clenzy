-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 0363 — Jeton public non devinable sur les médias                         │
-- │ Audit sécurité 2026-07-26, constat P1-06                                  │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- POURQUOI
-- `GET /api/public/media/{id}` est anonyme et l'identifiant est séquentiel : toute
-- la médiathèque de TOUTES les organisations est énumérable par un tiers. Le filtre
-- par organisation est impossible sur cette route (elle est hors du TenantFilter,
-- il n'existe aucune organisation courante à comparer), et l'URL ne peut pas être
-- simplement changée : elle est déjà figée dans les pages des sites publiés.
--
-- Le trou ne se limite pas à l'énumération : tout fichier déposé dans la médiathèque
-- devient servable publiquement à l'instant de l'upload, même s'il n'est jamais placé
-- dans une page (brouillons, visuels en préparation).
--
-- CE QUE FAIT CE CHANGESET
-- Ajoute un jeton opaque par média. Les URLs neuves porteront le jeton ; la route par
-- identifiant reste servie en compatibilité le temps que les pages se republient, puis
-- sera retirée (voir REMEDIATION-PLAN.md, P1-06 — la dépréciation est ce qui referme
-- réellement le dossier).
--
-- gen_random_uuid() est natif depuis PostgreSQL 13 (l'extension pgcrypto n'est pas
-- requise). La production est en PostgreSQL 16.
--
-- ROLLBACK : DROP de la colonne. Les URLs par identifiant continuent de fonctionner,
-- donc aucune page publiée ne casse.

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS public_token uuid;

-- Backfill des médias existants. DEFAULT posé APRÈS le backfill : sur une grosse
-- table, un DEFAULT volatile ajouté en même temps que la colonne forcerait une
-- réécriture complète.
UPDATE media_assets SET public_token = gen_random_uuid() WHERE public_token IS NULL;

ALTER TABLE media_assets ALTER COLUMN public_token SET DEFAULT gen_random_uuid();
ALTER TABLE media_assets ALTER COLUMN public_token SET NOT NULL;

-- Unique : le jeton est un identifiant de recherche, une collision servirait le
-- mauvais binaire. L'index sert aussi la résolution sur la route publique.
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_assets_public_token
    ON media_assets (public_token);
