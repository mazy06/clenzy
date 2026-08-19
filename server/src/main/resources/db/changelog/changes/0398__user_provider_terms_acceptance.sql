-- CGU prestataire — acceptation horodatee (V1).
--
-- Un intervenant (menage, maintenance, blanchisserie, exterieurs) doit accepter
-- les conditions de prestation avant d'etre paye : c'est ce qui rend la retenue
-- de commission et le reversement opposables.
--
-- V1 = ACCEPTATION, pas signature. Des CGU se satisfont juridiquement d'une
-- trace horodatee (version, date, IP) ; le moteur de signature electronique
-- (ContractSignatureRequest, certificat iText) reste reserve aux MANDATS de
-- gestion proprietaire, qui engagent la gestion d'un bien.
--
-- La VERSION est stockee et non un simple booleen : republier des CGU doit
-- pouvoir redemander l'acceptation sans perdre la trace de la precedente.

ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_terms_version VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_terms_accepted_at TIMESTAMP;
-- 45 caracteres : longueur maximale d'une IPv6 avec zone (RFC 4007).
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_terms_accepted_ip VARCHAR(45);

COMMENT ON COLUMN users.provider_terms_version IS
    'Version des CGU prestataire acceptee (NULL = jamais acceptees).';
COMMENT ON COLUMN users.provider_terms_accepted_at IS
    'Horodatage de l''acceptation des CGU prestataire.';
COMMENT ON COLUMN users.provider_terms_accepted_ip IS
    'IP cliente au moment de l''acceptation (preuve, resolue via TrustedClientIpResolver).';
