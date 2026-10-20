-- Existing tables verified against Prospect, User and changeset 0568.
CREATE TABLE baitly_crm_contact_details (
    organization_id bigint NOT NULL REFERENCES organizations(id),
    prospect_id bigint NOT NULL,
    assigned_user_id bigint REFERENCES users(id),
    company_name varchar(255),
    job_title varchar(150),
    specific_role varchar(150),
    region varchar(150),
    qualification varchar(30) NOT NULL DEFAULT 'TO_QUALIFY' CHECK(qualification IN ('TO_QUALIFY','QUALIFIED','UNQUALIFIED')),
    recorded_by varchar(255) NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(organization_id,prospect_id),
    FOREIGN KEY(organization_id,prospect_id) REFERENCES prospects(organization_id,id)
);
CREATE INDEX baitly_crm_details_assignee_idx ON baitly_crm_contact_details(organization_id,assigned_user_id);
