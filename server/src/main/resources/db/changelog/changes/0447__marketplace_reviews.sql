-- Baitly : seuls les avis issus d'une mission sont agrégés, aucun avis simulé.
CREATE TABLE marketplace_reviews (
    quote_request_id BIGINT PRIMARY KEY REFERENCES marketplace_quote_requests(id),
    provider_id BIGINT NOT NULL REFERENCES marketplace_providers(id),
    intervention_id BIGINT NOT NULL UNIQUE REFERENCES interventions(id),
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    author_user_id BIGINT NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    feedback VARCHAR(1000),
    created_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_marketplace_reviews_provider ON marketplace_reviews(provider_id);
