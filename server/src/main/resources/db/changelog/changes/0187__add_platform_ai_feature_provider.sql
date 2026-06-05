-- Assignation feature IA -> provider connecte (BYOK OpenAI/Anthropic).
-- Alternative a platform_ai_feature_model : permet d'affecter un provider connecte
-- (cle org BYOK ou cle partagee plateforme) a une feature, plutot qu'un modele
-- plateforme. Mutuellement exclusif avec platform_ai_feature_model (exclusivite
-- garantie applicativement par PlatformAiConfigService : assigner l'un supprime l'autre).
CREATE TABLE platform_ai_feature_provider (
    id         BIGSERIAL PRIMARY KEY,
    feature    VARCHAR(30) NOT NULL UNIQUE,
    provider   VARCHAR(30) NOT NULL,
    updated_at TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_ai_feature_provider_feature ON platform_ai_feature_provider(feature);
