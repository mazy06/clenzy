-- 0286 : contrat de variables CSS de design (`--bt-*`) du booking engine.
-- Map JSON de variables CSS émise par le LLM lors de la génération de site, assainie (CssSanitizer),
-- appliquée AU MÊME design aux pages ET aux widgets. NULL = aucun contrat (fallbacks du skin).
ALTER TABLE booking_engine_configs
    ADD COLUMN IF NOT EXISTS design_css_variables TEXT;
