-- Shared JDBC table verified against 0577/0583/0585, independent of tenant CRM.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
ALTER TABLE baitly_directory_professionals
    ADD COLUMN contact_rank integer GENERATED ALWAYS AS (
        -(CASE WHEN nullif(btrim(coalesce(nullif(phone,''),rge_phone)),'') IS NOT NULL THEN 1 ELSE 0 END
        + CASE WHEN nullif(btrim(coalesce(nullif(email,''),rge_email)),'') IS NOT NULL THEN 1 ELSE 0 END)
    ) STORED;
CREATE INDEX idx_baitly_directory_name_rank ON baitly_directory_professionals ((lower(name) COLLATE "C"),id)
    WHERE NOT suppressed AND source_active;
CREATE INDEX idx_baitly_directory_contact_rank ON baitly_directory_professionals (contact_rank,id)
    WHERE NOT suppressed AND source_active;
CREATE INDEX idx_baitly_directory_name_trgm ON baitly_directory_professionals USING gin (name public.gin_trgm_ops)
    WHERE NOT suppressed AND source_active;
CREATE INDEX idx_baitly_directory_city_trgm ON baitly_directory_professionals USING gin (city public.gin_trgm_ops)
    WHERE NOT suppressed AND source_active;
CREATE INDEX idx_baitly_directory_postal_trgm ON baitly_directory_professionals USING gin (postal_code public.gin_trgm_ops)
    WHERE NOT suppressed AND source_active;
CREATE INDEX idx_baitly_directory_siret_trgm ON baitly_directory_professionals USING gin (siret public.gin_trgm_ops)
    WHERE NOT suppressed AND source_active;
CREATE TABLE baitly_directory_map_state (
    id boolean PRIMARY KEY DEFAULT true CHECK(id),
    revision bigint NOT NULL DEFAULT 1,
    indexed_revision bigint NOT NULL DEFAULT 0,
    indexed_at timestamptz
);
INSERT INTO baitly_directory_map_state(id) VALUES(true);
CREATE TABLE baitly_directory_map_cells (
    revision bigint NOT NULL,
    level integer NOT NULL,
    x integer NOT NULL,
    y integer NOT NULL,
    activity varchar(10) NOT NULL,
    contact_mask integer NOT NULL,
    count bigint NOT NULL,
    sum_lat double precision NOT NULL,
    sum_lon double precision NOT NULL,
    west double precision NOT NULL,
    south double precision NOT NULL,
    east double precision NOT NULL,
    north double precision NOT NULL,
    representative_id bigint NOT NULL,
    PRIMARY KEY(revision,level,x,y,activity,contact_mask)
);
CREATE FUNCTION baitly_directory_map_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE baitly_directory_map_state SET revision=revision+1 WHERE id=true;
    RETURN NULL;
END;
$$;
CREATE TRIGGER baitly_directory_map_changed AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE
    ON baitly_directory_professionals FOR EACH STATEMENT EXECUTE FUNCTION baitly_directory_map_changed();
