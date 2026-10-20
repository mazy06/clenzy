-- Parent names verified against Prospect, Organization and changeset 0568.
CREATE TABLE baitly_crm_contact_locations (
    organization_id bigint NOT NULL REFERENCES organizations(id),
    prospect_id bigint NOT NULL,
    label varchar(500) NOT NULL CHECK(length(btrim(label))>0),
    latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
    longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
    precision varchar(20) NOT NULL CHECK(precision IN ('CITY','ADDRESS')),
    contact_city varchar(255),
    recorded_by varchar(255) NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(organization_id,prospect_id),
    FOREIGN KEY(organization_id,prospect_id) REFERENCES prospects(organization_id,id)
);
