-- Origine du code d'accès d'une serrure connectée (choix à l'ajout du device) :
--   PMS_GENERATED  : le PMS génère le code (format du logement) et le pousse à la serrure.
--   LOCK_GENERATED : la serrure génère son code aléatoire, le PMS le récupère.
ALTER TABLE smart_lock_devices
    ADD COLUMN IF NOT EXISTS access_code_mode VARCHAR(20) NOT NULL DEFAULT 'PMS_GENERATED';
