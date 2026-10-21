ALTER TABLE baitly_crm_contact_locations
    ADD COLUMN osm_type varchar(10) CHECK (osm_type IN ('node','way','relation')),
    ADD COLUMN osm_id bigint CHECK (osm_id > 0),
    ADD COLUMN osm_query varchar(300),
    ADD COLUMN osm_confirmed_at timestamptz;
