-- Shared JDBC reference table, verified against 0577/0589; not a new JPA enterprise entity.
ALTER TABLE baitly_directory_professionals DROP CONSTRAINT baitly_directory_country_identity;
ALTER TABLE baitly_directory_professionals ADD CONSTRAINT baitly_directory_country_identity CHECK (
    (country_code='FR' AND identifier_type='SIRET' AND siret=identifier AND siret IS NOT NULL)
    OR (country_code='MA' AND siret IS NULL AND identifier_type IN ('ICE','RC') AND base_source='OMPIC')
    OR (country_code='SA' AND siret IS NULL AND identifier_type IN ('UNN','CR') AND base_source='WATHQ')
    OR (country_code='SA' AND siret IS NULL AND identifier_type='OSM' AND base_source='OSM'
        AND identifier ~ '^(node|way|relation)/[1-9][0-9]{0,18}$')
);
