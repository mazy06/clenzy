-- Fondation « Clenzy Sites » (P1.1) : sites hébergés SSR (consommés par le service Next.js).
-- Site = couche site hébergé (distincte du widget BookingEngineConfig) ; SitePage = pages composées
-- par blocs ; SiteDomain = domaines custom + sous-domaines (TLS via Cloudflare for SaaS).

CREATE TABLE sites (
    id                       BIGSERIAL PRIMARY KEY,
    organization_id          BIGINT NOT NULL REFERENCES organizations(id),
    booking_engine_config_id BIGINT REFERENCES booking_engine_configs(id),
    slug                     VARCHAR(63) NOT NULL UNIQUE,
    name                     VARCHAR(150) NOT NULL DEFAULT 'Mon site',
    status                   VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    default_locale           VARCHAR(5) NOT NULL DEFAULT 'fr',
    locales                  VARCHAR(64) NOT NULL DEFAULT 'fr',
    design_tokens            TEXT,
    primary_color            VARCHAR(7),
    font_family              VARCHAR(100),
    logo_url                 VARCHAR(500),
    seo_title                VARCHAR(255),
    seo_description          TEXT,
    seo_og_image_url         VARCHAR(500),
    created_at               TIMESTAMP NOT NULL DEFAULT now(),
    updated_at               TIMESTAMP NOT NULL DEFAULT now(),
    version                  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sites_org_id ON sites(organization_id);

CREATE TABLE site_pages (
    id               BIGSERIAL PRIMARY KEY,
    site_id          BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    path             VARCHAR(255) NOT NULL,
    type             VARCHAR(30) NOT NULL DEFAULT 'CUSTOM',
    title            VARCHAR(255),
    blocks           TEXT,
    locale           VARCHAR(5),
    status           VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    sort_order       INTEGER NOT NULL DEFAULT 0,
    seo_title        VARCHAR(255),
    seo_description  TEXT,
    seo_og_image_url VARCHAR(500),
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_site_page_path UNIQUE (site_id, path, locale)
);
CREATE INDEX idx_site_pages_site_id ON site_pages(site_id);

CREATE TABLE site_domains (
    id                     BIGSERIAL PRIMARY KEY,
    site_id                BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    organization_id        BIGINT NOT NULL REFERENCES organizations(id),
    hostname               VARCHAR(253) NOT NULL UNIQUE,
    status                 VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    verified               BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary             BOOLEAN NOT NULL DEFAULT FALSE,
    cloudflare_hostname_id VARCHAR(128),
    created_at             TIMESTAMP NOT NULL DEFAULT now(),
    updated_at             TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_site_domains_site_id ON site_domains(site_id);
CREATE INDEX idx_site_domains_org_id ON site_domains(organization_id);
