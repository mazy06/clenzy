--liquibase formatted sql
--changeset clenzy-team:0109-add-country-city-to-team-coverage-zones splitStatements:false stripComments:false

-- Ajout des colonnes country (ISO 3166-1 alpha-2) et city (libelle) pour permettre
-- des zones de couverture hors France (Maroc, Arabie Saoudite, ...). Pour la France
-- on continue d'utiliser department + arrondissement; pour les autres pays, on
-- s'appuie sur le couple (country, city).

ALTER TABLE team_coverage_zones
    ADD COLUMN IF NOT EXISTS country VARCHAR(2),
    ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Backfill : toutes les lignes existantes sont francaises (seul pays supporte avant ce changement).
UPDATE team_coverage_zones SET country = 'FR' WHERE country IS NULL;

-- Le pays devient obligatoire ; le departement devient optionnel (NULL pour MA / SA / ...).
ALTER TABLE team_coverage_zones
    ALTER COLUMN country SET NOT NULL,
    ALTER COLUMN country SET DEFAULT 'FR',
    ALTER COLUMN department DROP NOT NULL;

-- Index pour la recherche pays + ville.
CREATE INDEX IF NOT EXISTS idx_tcz_country_city
    ON team_coverage_zones (country, LOWER(city))
    WHERE city IS NOT NULL;
