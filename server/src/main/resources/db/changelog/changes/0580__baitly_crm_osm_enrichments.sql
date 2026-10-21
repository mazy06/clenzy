-- prospects is @Table(name="prospects"); organization/id identity is defined by 0568.
CREATE TABLE baitly_crm_osm_enrichments (
    organization_id BIGINT NOT NULL,
    prospect_id BIGINT NOT NULL,
    siret VARCHAR(14) NOT NULL CHECK(siret ~ '^[0-9]{14}$'),
    osm_key VARCHAR(80) NOT NULL,
    method VARCHAR(30) NOT NULL CHECK(method = 'EXACT_SIRET'),
    licence VARCHAR(80) NOT NULL DEFAULT 'ODbL 1.0',
    recorded_by VARCHAR(255) NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    evidence JSONB NOT NULL,
    copied_fields JSONB NOT NULL,
    PRIMARY KEY(organization_id,prospect_id),
    FOREIGN KEY(organization_id,prospect_id) REFERENCES prospects(organization_id,id) ON DELETE CASCADE
);
