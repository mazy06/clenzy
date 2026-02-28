-- V82: Create exchange_rates table
-- Daily exchange rates for multi-currency support

CREATE TABLE exchange_rates (
    id              BIGSERIAL PRIMARY KEY,
    base_currency   VARCHAR(3) NOT NULL,
    target_currency VARCHAR(3) NOT NULL,
    rate            DECIMAL(12,6) NOT NULL,
    rate_date       DATE NOT NULL,
    source          VARCHAR(30) DEFAULT 'ECB',
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(base_currency, target_currency, rate_date)
);

CREATE INDEX idx_fx_lookup ON exchange_rates(base_currency, target_currency, rate_date DESC);
