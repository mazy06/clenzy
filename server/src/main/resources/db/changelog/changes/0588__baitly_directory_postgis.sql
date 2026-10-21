-- Rechecked on boot: older PostgreSQL images retain the indexed SQL fallback until infra is upgraded.
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='postgis') THEN
        CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
        IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
            AND table_name='baitly_directory_professionals' AND column_name='map_position') THEN
            ALTER TABLE baitly_directory_professionals ADD COLUMN map_position public.geography(Point,4326)
                GENERATED ALWAYS AS (CASE WHEN coalesce(latitude,sirene_latitude) BETWEEN -90 AND 90
                    AND coalesce(longitude,sirene_longitude) BETWEEN -180 AND 180
                    THEN public.ST_SetSRID(public.ST_MakePoint(coalesce(longitude,sirene_longitude),
                        coalesce(latitude,sirene_latitude)),4326)::public.geography END) STORED;
            CREATE INDEX idx_baitly_directory_position_gist ON baitly_directory_professionals
                USING gist(map_position) WHERE NOT suppressed AND source_active;
            CREATE INDEX idx_baitly_directory_bounds_gist ON baitly_directory_professionals
                USING gist((map_position::public.geometry)) WHERE NOT suppressed AND source_active;
        END IF;
    END IF;
    IF position('pg_stat_statements' in current_setting('shared_preload_libraries'))>0
       AND EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pg_stat_statements') THEN
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;
    END IF;
END;
$$;
