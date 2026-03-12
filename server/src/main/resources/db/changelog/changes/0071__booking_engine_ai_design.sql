-- 0071 : Add AI design analysis columns to booking_engine_configs
-- Supports Feature 1 (AI Design Matching) — stores extracted design tokens,
-- source website URL, and content hash for cache invalidation.

-- Design tokens JSON (extracted by AI or set manually)
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS design_tokens TEXT;

-- Source website URL (for AI design matching)
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS source_website_url VARCHAR(500);

-- SHA-256 hash of fetched website content (cache invalidation)
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS ai_analysis_hash VARCHAR(64);

-- Timestamp of last AI analysis
ALTER TABLE booking_engine_configs ADD COLUMN IF NOT EXISTS ai_analysis_at TIMESTAMP;
