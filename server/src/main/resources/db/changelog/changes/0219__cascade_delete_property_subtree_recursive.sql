-- Suppression d'une propriété : cascade RÉCURSIVE sur tout le sous-arbre de dépendances.
--
-- 0218 ne couvrait que properties + smart_lock_devices + noise_devices ; il restait des chaînes
-- plus profondes non cascadées (ex. noise_alert_configs → noise_alert_time_windows), qui font
-- échouer le DELETE par violation de contrainte FK.
--
-- Ici on part de `properties` et, niveau par niveau, on convertit en ON DELETE CASCADE chaque FK
-- pointant vers une table déjà dans le sous-arbre, puis on descend dans les tables enfants
-- découvertes — jusqu'à épuisement. Idempotent (les FK déjà cascadées par 0218 sont conservées,
-- on descend quand même dedans).
--
-- EXCLUSIONS : tables fiscales/légales (invoices, document_generations). On NE cascade PAS vers
-- elles : une propriété rattachée à des factures restera non supprimable (protection des données
-- fiscales / numérotation NF) plutôt que de les effacer silencieusement.
--
-- Bornée au sous-arbre propriété : organizations / users / guests (référencés PAR la propriété,
-- donc "au-dessus") ne sont jamais touchés — on ne convertit que les FK pointant VERS le sous-arbre.
DO $$
DECLARE
    target_tables   text[] := ARRAY['properties'];
    excluded_tables text[] := ARRAY['invoices', 'document_generations'];
    discovered      text[];
    r               RECORD;
BEGIN
    LOOP
        discovered := ARRAY[]::text[];
        FOR r IN
            SELECT con.conname,
                   con.conrelid::regclass::text          AS child_table,
                   child.relname                          AS child_name,
                   pg_get_constraintdef(con.oid)          AS def,
                   (pg_get_constraintdef(con.oid) ILIKE '%ON DELETE%') AS has_on_delete
            FROM pg_constraint con
            JOIN pg_class ref   ON ref.oid   = con.confrelid
            JOIN pg_class child ON child.oid = con.conrelid
            WHERE con.contype = 'f'
              AND ref.relname = ANY(target_tables)
              AND child.relname <> ALL(excluded_tables)
        LOOP
            IF NOT r.has_on_delete THEN
                EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.child_table, r.conname);
                EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON DELETE CASCADE',
                               r.child_table, r.conname, r.def);
            END IF;
            discovered := array_append(discovered, r.child_name);
        END LOOP;

        -- Ne garder que les tables enfants pas encore explorées (descente d'un niveau).
        discovered := ARRAY(
            SELECT DISTINCT t FROM unnest(discovered) AS t
            WHERE t <> ALL(target_tables)
        );
        EXIT WHEN array_length(discovered, 1) IS NULL;
        target_tables := target_tables || discovered;
    END LOOP;
END $$;
