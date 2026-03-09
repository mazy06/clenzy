-- Ajouter les champs de paiement sur service_requests pour le nouveau workflow
-- SR créée → auto-assignée → paiement par le demandeur → intervention créée
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
