-- Tables vérifiées contre PendingInscription et BaitlySubscriptionOrder (changeset 0518).
ALTER TABLE pending_inscriptions ADD COLUMN IF NOT EXISTS request_id UUID UNIQUE;
ALTER TABLE pending_inscriptions ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(64);
ALTER TABLE pending_inscriptions ADD COLUMN IF NOT EXISTS billing_country VARCHAR(2);
ALTER TABLE baitly_subscription_orders ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE baitly_subscription_orders ALTER COLUMN payer_user_id DROP NOT NULL;
ALTER TABLE baitly_subscription_orders ADD COLUMN IF NOT EXISTS signup_id BIGINT UNIQUE REFERENCES pending_inscriptions(id);
ALTER TABLE baitly_subscription_orders ADD CONSTRAINT ck_baitly_subscription_owner
 CHECK ((organization_id IS NOT NULL AND payer_user_id IS NOT NULL) OR signup_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_baitly_signup_open_email
 ON pending_inscriptions(lower(email))
 WHERE request_id IS NOT NULL AND status IN ('PENDING_PAYMENT','PAYMENT_CONFIRMED');
