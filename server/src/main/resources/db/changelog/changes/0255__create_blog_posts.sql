-- Blog / CMS des sites hébergés (P1.3) : articles rattachés à un site, rendus SSR + RSS + schema Article.
CREATE TABLE blog_posts (
    id               BIGSERIAL PRIMARY KEY,
    site_id          BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    organization_id  BIGINT NOT NULL REFERENCES organizations(id),
    slug             VARCHAR(255) NOT NULL,
    locale           VARCHAR(5),
    title            VARCHAR(255) NOT NULL,
    excerpt          TEXT,
    body             TEXT,
    cover_image_url  VARCHAR(500),
    tags             VARCHAR(512),
    status           VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    seo_title        VARCHAR(255),
    seo_description  TEXT,
    seo_og_image_url VARCHAR(500),
    published_at     TIMESTAMP,
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_blog_post_slug UNIQUE (site_id, slug, locale)
);
CREATE INDEX idx_blog_posts_site_id ON blog_posts(site_id);
CREATE INDEX idx_blog_posts_org_id ON blog_posts(organization_id);
