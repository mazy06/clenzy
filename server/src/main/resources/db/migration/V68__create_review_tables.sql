-- Phase 3: Review Management tables

CREATE TABLE guest_reviews (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    reservation_id BIGINT,
    channel_name VARCHAR(50) NOT NULL,
    guest_name VARCHAR(255),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    host_response TEXT,
    host_responded_at TIMESTAMP,
    review_date DATE NOT NULL,
    external_review_id VARCHAR(255),
    sentiment_score DOUBLE PRECISION,
    sentiment_label VARCHAR(20),
    language VARCHAR(10),
    tags JSONB DEFAULT '[]',
    is_public BOOLEAN DEFAULT TRUE,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_guest_reviews_org_property ON guest_reviews(organization_id, property_id);
CREATE INDEX idx_guest_reviews_channel ON guest_reviews(channel_name);
CREATE INDEX idx_guest_reviews_rating ON guest_reviews(rating);
CREATE INDEX idx_guest_reviews_review_date ON guest_reviews(review_date);
CREATE INDEX idx_guest_reviews_sentiment ON guest_reviews(sentiment_label);
CREATE UNIQUE INDEX idx_guest_reviews_external ON guest_reviews(organization_id, channel_name, external_review_id)
    WHERE external_review_id IS NOT NULL;

CREATE TABLE review_auto_responses (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    min_rating INTEGER DEFAULT 1,
    max_rating INTEGER DEFAULT 5,
    sentiment_filter VARCHAR(20),
    language VARCHAR(10),
    response_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_auto_responses_org ON review_auto_responses(organization_id);
