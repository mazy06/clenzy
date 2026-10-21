ALTER TABLE baitly_crm_contact_locations ALTER COLUMN osm_query TYPE varchar(600);
CREATE TABLE baitly_crm_location_batches (
    id uuid PRIMARY KEY,
    organization_id bigint NOT NULL REFERENCES organizations(id),
    created_by varchar(255) NOT NULL,
    country varchar(2) NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
    status varchar(20) NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING','COMPLETED','CANCELLED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id,id)
);
CREATE UNIQUE INDEX baitly_crm_one_location_batch_running ON baitly_crm_location_batches(organization_id) WHERE status='RUNNING';
CREATE INDEX baitly_crm_location_batch_latest ON baitly_crm_location_batches(organization_id,created_at DESC);
CREATE TABLE baitly_crm_location_batch_items (
    organization_id bigint NOT NULL,
    batch_id uuid NOT NULL,
    prospect_id bigint NOT NULL,
    status varchar(20) NOT NULL CHECK (status IN ('QUEUED','PROPOSED','NOT_FOUND','NEEDS_DATA','FAILED','CONFIRMED','SKIPPED')),
    proposal jsonb,
    attempts integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (batch_id,prospect_id),
    FOREIGN KEY (organization_id,batch_id) REFERENCES baitly_crm_location_batches(organization_id,id),
    FOREIGN KEY (organization_id,prospect_id) REFERENCES prospects(organization_id,id)
);
CREATE INDEX baitly_crm_location_batch_queue ON baitly_crm_location_batch_items(available_at) WHERE status='QUEUED';
