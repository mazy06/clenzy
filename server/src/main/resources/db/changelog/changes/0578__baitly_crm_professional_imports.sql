-- prospects is @Table(name="prospects"); composite identity introduced by 0568.
-- Store source identity per organization, including archived contacts, without publishing map coordinates.
CREATE TABLE baitly_crm_professional_imports (
    organization_id BIGINT NOT NULL,
    prospect_id BIGINT NOT NULL,
    siret VARCHAR(14) NOT NULL CHECK(siret ~ '^[0-9]{14}$'),
    source_url VARCHAR(500) NOT NULL,
    licence VARCHAR(80) NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    imported_by VARCHAR(255) NOT NULL,
    snapshot JSONB NOT NULL,
    PRIMARY KEY(organization_id,siret),
    UNIQUE(organization_id,prospect_id),
    FOREIGN KEY(organization_id,prospect_id) REFERENCES prospects(organization_id,id)
);
