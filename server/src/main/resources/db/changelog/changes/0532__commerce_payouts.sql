CREATE TABLE baitly_commerce_payouts (
 id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL, source VARCHAR(30) NOT NULL CHECK(source IN ('UPSELL','AFFILIATE')),
 source_id BIGINT NOT NULL, party VARCHAR(20) NOT NULL CHECK(party IN ('OWNER','CONCIERGE')),
 beneficiary_user_id BIGINT, beneficiary_organization_id BIGINT, request_id UUID NOT NULL,
 amount NUMERIC(12,2) NOT NULL CHECK(amount>0), currency VARCHAR(3) NOT NULL, destination VARCHAR(100) NOT NULL,
 actor VARCHAR(255) NOT NULL, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 CHECK ((beneficiary_user_id IS NULL) <> (beneficiary_organization_id IS NULL)), UNIQUE(organization_id,request_id)
);
CREATE INDEX idx_commerce_payout_source ON baitly_commerce_payouts(organization_id,source,source_id);
CREATE TABLE baitly_commerce_recoveries (
 id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL, payout_id BIGINT NOT NULL REFERENCES baitly_commerce_payouts(id),
 transfer_id BIGINT NOT NULL REFERENCES payout_transfers(id), amount NUMERIC(12,2) NOT NULL CHECK(amount>0),
 cause VARCHAR(255) NOT NULL, state VARCHAR(30) NOT NULL CHECK(state IN ('PENDING','PROCESSING','REVIEW_REQUIRED','RECOVERED')),
 reference VARCHAR(255) UNIQUE, failure VARCHAR(80), first_attempt_at TIMESTAMP WITH TIME ZONE,
 next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL, created_at TIMESTAMP WITH TIME ZONE NOT NULL,
 UNIQUE(transfer_id,cause)
);
CREATE INDEX idx_commerce_recovery_queue ON baitly_commerce_recoveries(state,next_attempt_at);
ALTER TABLE payout_transfers DROP CONSTRAINT IF EXISTS payout_transfers_source_check;
ALTER TABLE payout_transfers ADD CONSTRAINT payout_transfers_source_check CHECK(source IN ('OWNER_PAYOUT','INTERVENTION','PROVIDER_EXPENSE','COMMERCE'));
