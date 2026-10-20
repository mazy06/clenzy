-- New Baitly reference tables. marketplace_providers is @Table marketplace_providers (0418).
CREATE TABLE baitly_directory_professionals (
    id BIGSERIAL PRIMARY KEY,
    siret VARCHAR(14) NOT NULL UNIQUE CHECK(siret ~ '^[0-9]{14}$'),
    name VARCHAR(200) NOT NULL,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(120) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    activity VARCHAR(10) NOT NULL,
    sirene_latitude DOUBLE PRECISION,
    sirene_longitude DOUBLE PRECISION,
    sirene_retrieved_at TIMESTAMPTZ NOT NULL,
    recorded_by VARCHAR(100) NOT NULL,
    osm_key VARCHAR(50) UNIQUE CHECK(osm_key IS NULL OR osm_key ~ '^(node|way|relation)/[0-9]+$'),
    osm_name VARCHAR(200),
    osm_address VARCHAR(500),
    latitude DOUBLE PRECISION CHECK(latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION CHECK(longitude BETWEEN -180 AND 180),
    phone VARCHAR(80),email VARCHAR(254),website VARCHAR(500),
    osm_retrieved_at TIMESTAMPTZ,osm_confirmed_at TIMESTAMPTZ,osm_confirmed_by VARCHAR(100),
    suppressed BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK((osm_key IS NULL AND osm_confirmed_at IS NULL AND latitude IS NULL AND longitude IS NULL)
        OR (osm_key IS NOT NULL AND osm_confirmed_at IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL))
);
CREATE INDEX idx_baitly_directory_visible ON baitly_directory_professionals(name,id) WHERE suppressed=false;
CREATE TABLE baitly_directory_source_evidence (
    id BIGSERIAL PRIMARY KEY,
    professional_id BIGINT NOT NULL REFERENCES baitly_directory_professionals(id),
    source VARCHAR(10) NOT NULL CHECK(source IN ('SIRENE','OSM')),
    source_url VARCHAR(500) NOT NULL,licence VARCHAR(80) NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL,confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_by VARCHAR(100) NOT NULL,snapshot JSONB NOT NULL
);
CREATE INDEX idx_baitly_directory_evidence ON baitly_directory_source_evidence(professional_id,id);
