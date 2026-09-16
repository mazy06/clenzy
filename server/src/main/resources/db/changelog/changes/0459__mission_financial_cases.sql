-- Baitly : décisions financières séparées de l'annulation opérationnelle.
-- Références vérifiées : service_quote_cancellations (0456), service_quotes et payment_transactions.
CREATE TABLE mission_financial_cases (
    quote_id BIGINT PRIMARY KEY REFERENCES service_quote_cancellations(quote_id),
    organization_id BIGINT NOT NULL,
    state VARCHAR(24) NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN','DISPUTED','CLOSED')),
    accounting_state VARCHAR(16) NOT NULL DEFAULT 'NONE' CHECK (accounting_state IN ('NONE','REVIEW','DONE')),
    amount_due NUMERIC(19,2) CHECK (amount_due>=0),
    assessment_reason VARCHAR(1000),
    version BIGINT NOT NULL DEFAULT 0,
    reason VARCHAR(1000) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error VARCHAR(1000)
);
CREATE INDEX idx_mission_financial_check ON mission_financial_cases(next_check_at);
CREATE TABLE mission_financial_payments (
    id BIGSERIAL PRIMARY KEY,
    quote_id BIGINT NOT NULL REFERENCES mission_financial_cases(quote_id),
    provider VARCHAR(30) NOT NULL,
    session_ref VARCHAR(255) NOT NULL,
    payment_intent VARCHAR(255),
    currency VARCHAR(8),
    collected BIGINT NOT NULL DEFAULT 0 CHECK (collected >= 0),
    refunded BIGINT NOT NULL DEFAULT 0 CHECK (refunded >= 0),
    shared BOOLEAN NOT NULL DEFAULT false,
    allocation BIGINT CHECK (allocation>=0),
    state VARCHAR(24) NOT NULL DEFAULT 'UNVERIFIED',
    checked_at TIMESTAMPTZ,
    UNIQUE (quote_id, provider, session_ref)
);
CREATE TABLE mission_financial_decisions (
    id UUID PRIMARY KEY,
    quote_id BIGINT NOT NULL REFERENCES mission_financial_cases(quote_id),
    payment_id BIGINT NOT NULL REFERENCES mission_financial_payments(id),
    amount BIGINT NOT NULL CHECK (amount > 0),
    reason VARCHAR(1000) NOT NULL,
    allocation_evidence VARCHAR(1000),
    state VARCHAR(24) NOT NULL CHECK (state IN ('PROPOSED','APPROVED','PROCESSING','PENDING','SUCCEEDED','FAILED','WITHDRAWN','REVIEW')),
    proposed_by VARCHAR(120) NOT NULL,
    approved_by VARCHAR(120),
    refund_ref VARCHAR(255),
    notified_at TIMESTAMPTZ,
    notice_error VARCHAR(1000),
    error VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_until TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_mission_financial_pending ON mission_financial_decisions(payment_id)
 WHERE state IN ('PROPOSED','APPROVED','PROCESSING','PENDING','REVIEW');
CREATE INDEX idx_mission_financial_work ON mission_financial_decisions(next_attempt_at)
 WHERE state IN ('APPROVED','PROCESSING','PENDING');
CREATE TABLE mission_financial_events (
    id BIGSERIAL PRIMARY KEY,
    quote_id BIGINT NOT NULL REFERENCES mission_financial_cases(quote_id),
    actor VARCHAR(120) NOT NULL,
    action VARCHAR(40) NOT NULL,
    detail VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO mission_financial_cases(quote_id,organization_id,reason)
 SELECT quote_id,organization_id,reason FROM service_quote_cancellations;
