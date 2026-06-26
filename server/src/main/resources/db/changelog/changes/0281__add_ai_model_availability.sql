-- Disponibilité des modèles IA configurés (probe proactif).
-- Permet d'afficher le statut dans « Models & features » et de notifier l'admin
-- AVANT que les utilisateurs ne tombent sur un modèle retiré chez le provider
-- (Anthropic, NVIDIA, OpenAI…) → erreur 404/410.
ALTER TABLE platform_ai_model
    ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN IF NOT EXISTS last_availability_check_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS availability_error TEXT;
