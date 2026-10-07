-- Noms vérifiés dans BaitlySubscriptionOrder, Organization et User.
ALTER TABLE platform_promo_codes ADD COLUMN currency VARCHAR(3);
CREATE TABLE baitly_subscription_orders (
 id BIGSERIAL PRIMARY KEY,
 organization_id BIGINT NOT NULL REFERENCES organizations(id),
 payer_user_id BIGINT NOT NULL REFERENCES users(id),
 request_id UUID NOT NULL,
 plan VARCHAR(20) NOT NULL CHECK(plan IN ('essential','pro')),
 market VARCHAR(4) NOT NULL CHECK(market IN ('EU','MA','SA')),
 currency VARCHAR(3) NOT NULL,
 properties INTEGER NOT NULL CHECK(properties BETWEEN 1 AND 49),
 price_version VARCHAR(50) NOT NULL,
 month_one_cents BIGINT NOT NULL CHECK(month_one_cents>=0),
 month_four_cents BIGINT NOT NULL CHECK(month_four_cents>=0),
 month_seven_cents BIGINT NOT NULL CHECK(month_seven_cents>=0),
 month_thirteen_cents BIGINT NOT NULL CHECK(month_thirteen_cents>=0),
 status VARCHAR(32) NOT NULL DEFAULT 'PREPARED',
 checkout_session_id VARCHAR(255) UNIQUE,
 checkout_url TEXT,
 stripe_subscription_id VARCHAR(255) UNIQUE,
 stripe_customer_id VARCHAR(255),
 previous_subscription_id VARCHAR(255),
 stripe_schedule_id VARCHAR(255),
 created_at TIMESTAMP NOT NULL,
 activated_at TIMESTAMP,
 first_invoice_cents BIGINT NOT NULL CHECK(first_invoice_cents>=0),
 promo_code_id BIGINT REFERENCES platform_promo_codes(id),
 promo_code VARCHAR(50),
 last_invoice_id VARCHAR(255),
 paid_until TIMESTAMP WITH TIME ZONE,
 cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
 subscription_month INTEGER NOT NULL DEFAULT 1 CHECK(subscription_month>=1),
 loyalty_started_at TIMESTAMP NOT NULL,
 UNIQUE(organization_id,request_id)
);
CREATE INDEX idx_baitly_subscription_org ON baitly_subscription_orders(organization_id,created_at DESC);
CREATE UNIQUE INDEX uq_baitly_subscription_pending ON baitly_subscription_orders(organization_id)
 WHERE status IN ('PREPARED','CHECKOUT_OPEN','ACTIVATING');
CREATE TABLE baitly_subscription_invoices (
 invoice_id VARCHAR(255) PRIMARY KEY,
 organization_id BIGINT NOT NULL REFERENCES organizations(id),
 order_id BIGINT NOT NULL REFERENCES baitly_subscription_orders(id),
 status VARCHAR(255) NOT NULL,
 currency VARCHAR(3) NOT NULL,
 total_cents BIGINT NOT NULL,
 excluding_tax_cents BIGINT NOT NULL,
 paid_cents BIGINT NOT NULL,
 remaining_cents BIGINT NOT NULL,
 hosted_url TEXT,
 pdf_url TEXT,
 issued_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_baitly_subscription_invoices_org ON baitly_subscription_invoices(organization_id,issued_at DESC);
