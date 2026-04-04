-- Platform AI models — liste des modeles IA configures par le SUPER_ADMIN
CREATE TABLE platform_ai_model (
    id                BIGSERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL,
    provider          VARCHAR(50)  NOT NULL,
    model_id          VARCHAR(150) NOT NULL,
    api_key           TEXT         NOT NULL,
    base_url          VARCHAR(500),
    last_validated_at TIMESTAMP,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_by        VARCHAR(100)
);

-- Association feature → modele actif (un seul modele actif par feature)
CREATE TABLE platform_ai_feature_model (
    id         BIGSERIAL PRIMARY KEY,
    feature    VARCHAR(30) NOT NULL UNIQUE,
    model_id   BIGINT      NOT NULL REFERENCES platform_ai_model(id) ON DELETE CASCADE,
    updated_at TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_ai_feature_model_feature ON platform_ai_feature_model(feature);
