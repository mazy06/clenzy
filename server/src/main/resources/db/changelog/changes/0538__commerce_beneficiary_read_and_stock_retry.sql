-- Baitly : lecture du compte personnel uniquement pour le bénéficiaire commercial figé.
CREATE POLICY received_commerce_owner_read ON payment_connections FOR SELECT
 USING(beneficiary_key=concat('user:',user_id) AND user_id IS NOT NULL AND (
   EXISTS(SELECT 1 FROM upsell_orders o WHERE o.organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint
     AND o.beneficiary_owner_id=payment_connections.user_id AND o.status IN ('PAID','REFUNDED'))
   OR EXISTS(SELECT 1 FROM activity_commissions a WHERE a.organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint
     AND a.beneficiary_owner_id=payment_connections.user_id AND a.received_at IS NOT NULL)
 ));
ALTER TABLE hardware_orders ADD COLUMN stock_check_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
CREATE INDEX idx_hardware_stock_retry ON hardware_orders(stock_check_at,id) WHERE status='PENDING';
