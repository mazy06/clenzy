-- I2-IOT-01 : secret partage par connexion pour authentifier le webhook public
-- du Nuki Bridge (/api/webhooks/nuki/bridge-callback/{token}). Le token de l'URL
-- est compare en temps constant a ce secret et resout l'organisation cible.
--
-- Colonne NOUVELLE : toutes les lignes existantes ont NULL. Aucune valeur en clair
-- preexistante -> aucun backfill de chiffrement requis (cf. EncryptedFieldConverter
-- mode STRICT : on ne pose @Convert que sur une colonne sans valeur en clair).
-- L'entite NukiConnection chiffre la valeur au repos via EncryptedFieldConverter
-- (AES-256), d'ou le suffixe _encrypted et le type TEXT (le ciphertext est plus
-- long que le secret en clair).
ALTER TABLE nuki_connections
    ADD COLUMN IF NOT EXISTS webhook_secret_encrypted TEXT;
