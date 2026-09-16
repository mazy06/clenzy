-- Une reprise invalide les écritures d'une ancienne tentative Baitly.
ALTER TABLE marketplace_provisioning_jobs
    ADD COLUMN claim_token UUID,
    ADD COLUMN retried_by VARCHAR(255),
    ADD COLUMN retried_at TIMESTAMP;
