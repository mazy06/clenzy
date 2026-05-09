-- liquibase formatted sql
-- changeset clenzy-team:0114-drop-legacy-url-from-property-photos

-- En prod, la table property_photos a ete creee a l'origine par Hibernate
-- ddl-auto=update avec une colonne `url VARCHAR NOT NULL` (ancienne version
-- de l'entite PropertyPhoto qui stockait l'URL S3). La migration 0093 qui
-- DROP+CREATE la table n'a jamais tourne en prod (Liquibase desactive),
-- donc Hibernate a juste ajoute les nouvelles colonnes (storage_key, data,
-- ...) en gardant `url NOT NULL`. Resultat : tout INSERT echoue avec
-- "null value in column url violates not-null constraint" depuis le passage
-- au stockage BYTEA.
--
-- Cette migration drop la colonne legacy. En dev/local ou la migration 0093
-- a recree la table proprement, IF EXISTS rend l'operation no-op.

ALTER TABLE property_photos DROP COLUMN IF EXISTS url;
