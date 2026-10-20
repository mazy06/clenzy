-- prospects maps to @Table(name="prospects"); composite identity is defined by 0568.
CREATE TABLE baitly_crm_address_geocodings (
    organization_id BIGINT NOT NULL,
    prospect_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL CHECK(provider='BAN'),
    reference VARCHAR(200) NOT NULL,
    licence VARCHAR(80) NOT NULL DEFAULT 'Licence Ouverte 2.0',
    recorded_by VARCHAR(255) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    evidence JSONB NOT NULL,
    PRIMARY KEY(organization_id,prospect_id),
    FOREIGN KEY(organization_id,prospect_id) REFERENCES prospects(organization_id,id) ON DELETE CASCADE
);
