-- Masters plateforme du concierge IA, pilotés en base (hot-reload, pas de redéploiement).
-- Le singleton platform_settings (id=1) porte ces toggles globaux ; le comportement
-- par organisation reste gouverné par supervision_module_settings (module « com »).
ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS concierge_draft_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS concierge_autosend_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS concierge_autosend_min_forfait TEXT NOT NULL DEFAULT 'premium';
