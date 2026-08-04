-- Consentement à la PLEINE autonomie d'un agent (constellation). Passer un
-- module en FULL, c'est le laisser agir seul ET en silence : la responsabilité
-- des actions revient à l'organisation, pas à la plateforme. On trace donc
-- QUI a accepté, QUAND, et sur QUELLE version du texte d'avertissement — sans
-- ces trois éléments, l'acceptation ne prouve rien.
-- Le serveur REFUSE le passage en FULL tant que ces colonnes sont vides
-- (cf. SupervisionConfigService) : l'acceptation n'est pas contournable par
-- un appel direct à l'API.
ALTER TABLE supervision_module_settings
    ADD COLUMN IF NOT EXISTS full_autonomy_accepted_at TIMESTAMP;
ALTER TABLE supervision_module_settings
    ADD COLUMN IF NOT EXISTS full_autonomy_accepted_by VARCHAR(120);
ALTER TABLE supervision_module_settings
    ADD COLUMN IF NOT EXISTS full_autonomy_notice_version VARCHAR(20);
