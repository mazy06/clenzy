-- V73: Management Contracts (Contrats de gestion)

CREATE TABLE IF NOT EXISTS management_contracts (
    id                      BIGSERIAL PRIMARY KEY,
    organization_id         BIGINT       NOT NULL REFERENCES organizations(id),
    property_id             BIGINT       NOT NULL REFERENCES properties(id),
    owner_id                BIGINT       NOT NULL REFERENCES users(id),
    contract_number         VARCHAR(50),
    contract_type           VARCHAR(30)  NOT NULL DEFAULT 'FULL_MANAGEMENT',
    status                  VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    start_date              DATE         NOT NULL,
    end_date                DATE,
    commission_rate         DECIMAL(5,4) NOT NULL,
    minimum_stay_nights     INTEGER,
    auto_renew              BOOLEAN      DEFAULT false,
    notice_period_days      INTEGER      DEFAULT 30,
    cleaning_fee_included   BOOLEAN      DEFAULT true,
    maintenance_included    BOOLEAN      DEFAULT true,
    notes                   TEXT,
    signed_at               TIMESTAMP WITH TIME ZONE,
    terminated_at           TIMESTAMP WITH TIME ZONE,
    termination_reason      TEXT,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mgmt_contracts_org ON management_contracts(organization_id);
CREATE INDEX idx_mgmt_contracts_property ON management_contracts(organization_id, property_id);
CREATE INDEX idx_mgmt_contracts_owner ON management_contracts(owner_id);
CREATE INDEX idx_mgmt_contracts_status ON management_contracts(status);
CREATE UNIQUE INDEX idx_mgmt_contracts_number ON management_contracts(contract_number) WHERE contract_number IS NOT NULL;
