-- Brute-force fix : 0109 et 0110 n'ont pas reellement ajoute les colonnes
-- country / city sur la prod (l'erreur "column cz1_0.country does not exist"
-- persiste). On utilise un bloc PL/pgSQL avec verification information_schema
-- pour etre sur que les colonnes existent (independamment de ce qu'a fait
-- Liquibase auparavant).

DO $$
BEGIN
    -- Ajout colonne country si absente
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'team_coverage_zones'
          AND column_name = 'country'
    ) THEN
        ALTER TABLE team_coverage_zones ADD COLUMN country VARCHAR(2);
        RAISE NOTICE 'Added column team_coverage_zones.country';
    END IF;

    -- Ajout colonne city si absente
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'team_coverage_zones'
          AND column_name = 'city'
    ) THEN
        ALTER TABLE team_coverage_zones ADD COLUMN city VARCHAR(100);
        RAISE NOTICE 'Added column team_coverage_zones.city';
    END IF;

    -- Backfill country a 'FR' pour les lignes deja presentes
    UPDATE team_coverage_zones SET country = 'FR' WHERE country IS NULL;

    -- Default 'FR' sur la colonne
    BEGIN
        ALTER TABLE team_coverage_zones ALTER COLUMN country SET DEFAULT 'FR';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Default already set on country: %', SQLERRM;
    END;

    -- NOT NULL sur country
    BEGIN
        ALTER TABLE team_coverage_zones ALTER COLUMN country SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'NOT NULL already set on country: %', SQLERRM;
    END;

    -- DROP NOT NULL sur department (devient optionnel pour les pays etrangers)
    BEGIN
        ALTER TABLE team_coverage_zones ALTER COLUMN department DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Department NOT NULL already dropped: %', SQLERRM;
    END;
END $$;

-- Index sur (country, lower(city)) pour la recherche par ville (hors France)
CREATE INDEX IF NOT EXISTS idx_tcz_country_city
    ON team_coverage_zones (country, LOWER(city))
    WHERE city IS NOT NULL;
