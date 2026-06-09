-- Rotation automatique du code d'accès statique après le départ du voyageur (opt-in par logement).
-- access_code_auto_rotate : active la régénération automatique après chaque checkout.
-- access_code_format      : format JSON ({pattern, letters, symbols}) pour régénérer à l'identique.
-- access_code_rotated_at  : dernière rotation (idempotence du scheduler).
ALTER TABLE check_in_instructions
    ADD COLUMN IF NOT EXISTS access_code_auto_rotate BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS access_code_format VARCHAR(500),
    ADD COLUMN IF NOT EXISTS access_code_rotated_at TIMESTAMP;
