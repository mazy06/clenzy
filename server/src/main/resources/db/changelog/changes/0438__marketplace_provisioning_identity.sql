-- Identité stable de l'opération Baitly, également portée par le compte Keycloak.
-- Les anciennes opérations reçoivent une clé ; aucun compte distant sans preuve n'est adopté.
ALTER TABLE marketplace_provisioning_jobs
    ADD COLUMN operation_key UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX uq_marketplace_provisioning_operation ON marketplace_provisioning_jobs(operation_key);
