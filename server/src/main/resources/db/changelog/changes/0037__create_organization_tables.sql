-- ============================================================================
-- V41: Multi-tenant — Creation des organisations et isolation des donnees
-- ============================================================================
-- Cette migration :
--   1. Cree les tables organizations et organization_members
--   2. Auto-cree une Organisation INDIVIDUAL par utilisateur existant
--   3. Ajoute organization_id a toutes les tables metier
--   4. Peuple organization_id via JOINs
--   5. Ajoute contraintes NOT NULL, FK et INDEX
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Creer table organizations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'INDIVIDUAL',
    slug VARCHAR(100) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    forfait VARCHAR(255),
    billing_period VARCHAR(20),
    deferred_payment BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_org_type ON organizations(type);
CREATE INDEX idx_org_stripe_customer ON organizations(stripe_customer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Creer table organization_members
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE organization_members (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_org VARCHAR(20) NOT NULL DEFAULT 'OWNER',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_org_member UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_member_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_member_user_id ON organization_members(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Ajouter organization_id sur users (nullable pour l'instant)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN organization_id BIGINT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Auto-creer 1 Organisation INDIVIDUAL par user existant
--    Copie stripe/forfait/billing depuis User vers Organization
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO organizations (name, type, slug, stripe_customer_id, stripe_subscription_id, forfait, billing_period, deferred_payment, created_at)
SELECT
    COALESCE(NULLIF(u.company_name, ''), u.first_name || ' ' || u.last_name),
    'INDIVIDUAL',
    'org-' || u.id,
    u.stripe_customer_id,
    u.stripe_subscription_id,
    u.forfait,
    u.billing_period,
    u.deferred_payment,
    u.created_at
FROM users u;

-- 5. Creer les OrganizationMember (OWNER) pour chaque user
INSERT INTO organization_members (organization_id, user_id, role_in_org, joined_at)
SELECT o.id, u.id, 'OWNER', u.created_at
FROM users u
JOIN organizations o ON o.slug = 'org-' || u.id;

-- 6. Set organization_id sur users
UPDATE users u SET organization_id = om.organization_id
FROM organization_members om WHERE om.user_id = u.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Ajouter organization_id (nullable) sur toutes les tables metier
-- ─────────────────────────────────────────────────────────────────────────────

-- Tables avec FK Long vers users
ALTER TABLE properties ADD COLUMN organization_id BIGINT;
ALTER TABLE service_requests ADD COLUMN organization_id BIGINT;
ALTER TABLE interventions ADD COLUMN organization_id BIGINT;
ALTER TABLE teams ADD COLUMN organization_id BIGINT;
ALTER TABLE team_members ADD COLUMN organization_id BIGINT;
ALTER TABLE reservations ADD COLUMN organization_id BIGINT;
ALTER TABLE portfolios ADD COLUMN organization_id BIGINT;
ALTER TABLE portfolio_clients ADD COLUMN organization_id BIGINT;
ALTER TABLE portfolio_teams ADD COLUMN organization_id BIGINT;
ALTER TABLE manager_properties ADD COLUMN organization_id BIGINT;
ALTER TABLE manager_users ADD COLUMN organization_id BIGINT;
ALTER TABLE manager_teams ADD COLUMN organization_id BIGINT;
ALTER TABLE property_teams ADD COLUMN organization_id BIGINT;
ALTER TABLE pricing_configs ADD COLUMN organization_id BIGINT;
ALTER TABLE gdpr_consents ADD COLUMN organization_id BIGINT;
ALTER TABLE team_coverage_zones ADD COLUMN organization_id BIGINT;

-- Tables avec FK String (keycloak_id) vers users
ALTER TABLE noise_devices ADD COLUMN organization_id BIGINT;
ALTER TABLE ical_feeds ADD COLUMN organization_id BIGINT;
ALTER TABLE notifications ADD COLUMN organization_id BIGINT;
ALTER TABLE notification_preferences ADD COLUMN organization_id BIGINT;
ALTER TABLE contact_messages ADD COLUMN organization_id BIGINT;
ALTER TABLE document_templates ADD COLUMN organization_id BIGINT;
ALTER TABLE document_generations ADD COLUMN organization_id BIGINT;
ALTER TABLE document_number_sequences ADD COLUMN organization_id BIGINT;
ALTER TABLE audit_log ADD COLUMN organization_id BIGINT;

-- Tables integration
ALTER TABLE airbnb_connections ADD COLUMN organization_id BIGINT;
ALTER TABLE tuya_connections ADD COLUMN organization_id BIGINT;

-- MinutConnection : renommer organization_id existant (c'est l'org Minut, pas la notre)
ALTER TABLE minut_connections RENAME COLUMN organization_id TO minut_organization_id;
ALTER TABLE minut_connections ADD COLUMN organization_id BIGINT;

-- ReceivedForm : formulaires publics, ajout optionnel
ALTER TABLE received_forms ADD COLUMN organization_id BIGINT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Peupler organization_id via JOINs
-- ─────────────────────────────────────────────────────────────────────────────

-- 8a. Tables avec owner_id / user_id Long FK vers users.id
UPDATE properties p SET organization_id = u.organization_id
FROM users u WHERE p.owner_id = u.id;

UPDATE service_requests sr SET organization_id = u.organization_id
FROM users u WHERE sr.user_id = u.id;

UPDATE interventions i SET organization_id = u.organization_id
FROM users u WHERE i.requestor_id = u.id;

UPDATE team_members tm SET organization_id = u.organization_id
FROM users u WHERE tm.user_id = u.id;

UPDATE portfolios pf SET organization_id = u.organization_id
FROM users u WHERE pf.manager_id = u.id;

UPDATE gdpr_consents gc SET organization_id = u.organization_id
FROM users u WHERE gc.user_id = u.id;

-- manager_* tables : via manager_id FK Long
UPDATE manager_properties mp SET organization_id = u.organization_id
FROM users u WHERE mp.manager_id = u.id;

UPDATE manager_users mu SET organization_id = u.organization_id
FROM users u WHERE mu.manager_id = u.id;

UPDATE manager_teams mt SET organization_id = u.organization_id
FROM users u WHERE mt.manager_id = u.id;

-- 8b. Tables derivees via parent deja peuple
UPDATE teams t SET organization_id = (
    SELECT u.organization_id FROM team_members tm2
    JOIN users u ON tm2.user_id = u.id
    WHERE tm2.team_id = t.id LIMIT 1
) WHERE EXISTS (
    SELECT 1 FROM team_members tm2 WHERE tm2.team_id = t.id
);

UPDATE reservations r SET organization_id = p.organization_id
FROM properties p WHERE r.property_id = p.id;

UPDATE portfolio_clients pc SET organization_id = pf.organization_id
FROM portfolios pf WHERE pc.portfolio_id = pf.id;

UPDATE portfolio_teams pt SET organization_id = pf.organization_id
FROM portfolios pf WHERE pt.portfolio_id = pf.id;

UPDATE property_teams pt SET organization_id = p.organization_id
FROM properties p WHERE pt.property_id = p.id;

UPDATE ical_feeds f SET organization_id = p.organization_id
FROM properties p WHERE f.property_id = p.id;

UPDATE team_coverage_zones tcz SET organization_id = t.organization_id
FROM teams t WHERE tcz.team_id = t.id;

-- 8c. Tables avec user_id String (keycloak_id)
UPDATE noise_devices nd SET organization_id = u.organization_id
FROM users u WHERE nd.user_id = u.keycloak_id;

UPDATE notifications n SET organization_id = u.organization_id
FROM users u WHERE n.user_id = u.keycloak_id;

UPDATE notification_preferences np SET organization_id = u.organization_id
FROM users u WHERE np.user_id = u.keycloak_id;

UPDATE contact_messages cm SET organization_id = u.organization_id
FROM users u WHERE cm.sender_keycloak_id = u.keycloak_id;

UPDATE document_templates dt SET organization_id = u.organization_id
FROM users u WHERE dt.created_by = u.keycloak_id;

UPDATE document_generations dg SET organization_id = u.organization_id
FROM users u WHERE dg.user_id = u.keycloak_id;

UPDATE audit_log al SET organization_id = u.organization_id
FROM users u WHERE al."userId" = u.keycloak_id;

-- 8d. Tables integration (user_id = keycloak_id)
UPDATE airbnb_connections ac SET organization_id = u.organization_id
FROM users u WHERE ac.user_id = u.keycloak_id;

UPDATE tuya_connections tc SET organization_id = u.organization_id
FROM users u WHERE tc.user_id = u.keycloak_id;

UPDATE minut_connections mc SET organization_id = u.organization_id
FROM users u WHERE mc.user_id = u.keycloak_id;

-- 8e. pricing_configs : peut avoir user_id NULL (config globale)
-- On ne met organization_id que si user_id est present
UPDATE pricing_configs pc SET organization_id = u.organization_id
FROM users u WHERE pc.user_id = u.id;

-- 8f. document_number_sequences : table globale type+year, pas de user_id
-- Sera scope par org plus tard, pour l'instant on la laisse nullable

-- 8g. received_forms : formulaires publics, pas de user_id direct
-- Laisse nullable pour l'instant

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Ajouter contraintes NOT NULL sur tables critiques
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE properties ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE service_requests ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE interventions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE reservations ALTER COLUMN organization_id SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Ajouter FK vers organizations(id)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users ADD CONSTRAINT fk_user_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE properties ADD CONSTRAINT fk_property_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE service_requests ADD CONSTRAINT fk_sr_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE interventions ADD CONSTRAINT fk_intervention_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE teams ADD CONSTRAINT fk_team_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE reservations ADD CONSTRAINT fk_reservation_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE portfolios ADD CONSTRAINT fk_portfolio_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE noise_devices ADD CONSTRAINT fk_noise_device_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE notifications ADD CONSTRAINT fk_notification_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Creer INDEX sur organization_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_user_org_id ON users(organization_id);
CREATE INDEX idx_property_org_id ON properties(organization_id);
CREATE INDEX idx_sr_org_id ON service_requests(organization_id);
CREATE INDEX idx_intervention_org_id ON interventions(organization_id);
CREATE INDEX idx_team_org_id ON teams(organization_id);
CREATE INDEX idx_reservation_org_id ON reservations(organization_id);
CREATE INDEX idx_notification_org_id ON notifications(organization_id);
CREATE INDEX idx_portfolio_org_id ON portfolios(organization_id);
CREATE INDEX idx_noise_device_org_id ON noise_devices(organization_id);
CREATE INDEX idx_team_member_org_id ON team_members(organization_id);
CREATE INDEX idx_manager_property_org_id ON manager_properties(organization_id);
CREATE INDEX idx_manager_user_org_id ON manager_users(organization_id);
CREATE INDEX idx_ical_feed_org_id ON ical_feeds(organization_id);
CREATE INDEX idx_contact_msg_org_id ON contact_messages(organization_id);
CREATE INDEX idx_doc_template_org_id ON document_templates(organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Verification : aucun NULL sur tables critiques
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE organization_id IS NULL) THEN
        RAISE EXCEPTION 'ERREUR V41: users contient des organization_id NULL';
    END IF;
    IF EXISTS (SELECT 1 FROM properties WHERE organization_id IS NULL) THEN
        RAISE EXCEPTION 'ERREUR V41: properties contient des organization_id NULL';
    END IF;
    IF EXISTS (SELECT 1 FROM service_requests WHERE organization_id IS NULL) THEN
        RAISE EXCEPTION 'ERREUR V41: service_requests contient des organization_id NULL';
    END IF;
    IF EXISTS (SELECT 1 FROM interventions WHERE organization_id IS NULL) THEN
        RAISE EXCEPTION 'ERREUR V41: interventions contient des organization_id NULL';
    END IF;
    IF EXISTS (SELECT 1 FROM reservations WHERE organization_id IS NULL) THEN
        RAISE EXCEPTION 'ERREUR V41: reservations contient des organization_id NULL';
    END IF;
END $$;
