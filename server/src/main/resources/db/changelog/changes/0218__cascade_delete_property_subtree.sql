-- Suppression d'une propriété : rendre les FK du sous-arbre « propriété » ON DELETE CASCADE.
--
-- Contexte : PropertyService.delete() = propertyRepository.deleteById(). Hibernate ne cascade
-- que serviceRequests + photos ; toutes les autres tables référençant `properties` (objets
-- connectés, calendrier, channels, etc.) bloquaient la suppression par violation de FK
-- (ex. smart_lock_devices). Les serrures/capteurs ont eux-mêmes des enfants
-- (smart_lock_access_codes, smart_lock_access_code_events, noise_alerts) qu'il faut aussi cascader.
--
-- Portée VOLONTAIREMENT bornée : on ne convertit QUE les FK pointant vers `properties` et vers
-- les tables d'objets connectés à enfants (smart_lock_devices, noise_devices). On ne touche pas
-- aux FK vers organizations/users, ni à la chaîne réservation→facture (les factures restent
-- protégées : une propriété avec des factures de séjour ne sera pas supprimable en silence).
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT con.conname,
               con.conrelid::regclass::text AS child_table,
               pg_get_constraintdef(con.oid)  AS def
        FROM pg_constraint con
        JOIN pg_class ref ON ref.oid = con.confrelid
        WHERE con.contype = 'f'
          AND ref.relname IN ('properties', 'smart_lock_devices', 'noise_devices')
          AND pg_get_constraintdef(con.oid) NOT ILIKE '%ON DELETE%'
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.child_table, r.conname);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON DELETE CASCADE',
                       r.child_table, r.conname, r.def);
    END LOOP;
END $$;
