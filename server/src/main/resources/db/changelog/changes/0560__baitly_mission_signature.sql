-- Fin de mission Baitly : signature du client sur place, ou absence déclarée par l'intervenant.
ALTER TABLE interventions ADD COLUMN baitly_signature_status VARCHAR(16);
ALTER TABLE interventions ADD COLUMN baitly_signer_name VARCHAR(160);
ALTER TABLE interventions ADD COLUMN baitly_signed_at TIMESTAMP;
ALTER TABLE interventions ADD CONSTRAINT interventions_baitly_signature_status_check
  CHECK (baitly_signature_status IS NULL OR baitly_signature_status IN ('SIGNED', 'CLIENT_ABSENT'));
