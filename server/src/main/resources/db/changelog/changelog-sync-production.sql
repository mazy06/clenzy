-- ============================================================================
-- Liquibase changelogSync pour la PRODUCTION
-- ============================================================================
-- Executez ce script UNE SEULE FOIS avant le premier demarrage avec Liquibase.
-- Il cree les tables de tracking Liquibase et marque les 54 changesets
-- historiques comme deja executes (sans les re-executer).
--
-- Usage:
--   docker exec clenzy-postgres-prod psql -U clenzy_prod_user -d clenzy_prod -f /path/to/changelog-sync-production.sql
--   OU copier-coller le contenu dans psql
-- ============================================================================

-- 1. Creer la table DATABASECHANGELOGLOCK
CREATE TABLE IF NOT EXISTS DATABASECHANGELOGLOCK (
    ID INTEGER NOT NULL PRIMARY KEY,
    LOCKED BOOLEAN NOT NULL,
    LOCKGRANTED TIMESTAMP,
    LOCKEDBY VARCHAR(255)
);
INSERT INTO DATABASECHANGELOGLOCK (ID, LOCKED) VALUES (1, FALSE)
    ON CONFLICT (ID) DO NOTHING;

-- 2. Creer la table DATABASECHANGELOG
CREATE TABLE IF NOT EXISTS DATABASECHANGELOG (
    ID VARCHAR(255) NOT NULL,
    AUTHOR VARCHAR(255) NOT NULL,
    FILENAME VARCHAR(255) NOT NULL,
    DATEEXECUTED TIMESTAMP NOT NULL,
    ORDEREXECUTED INTEGER NOT NULL,
    EXECTYPE VARCHAR(10) NOT NULL,
    MD5SUM VARCHAR(35),
    DESCRIPTION VARCHAR(255),
    COMMENTS VARCHAR(255),
    TAG VARCHAR(255),
    LIQUIBASE VARCHAR(20),
    CONTEXTS VARCHAR(255),
    LABELS VARCHAR(255),
    DEPLOYMENT_ID VARCHAR(10)
);

-- 3. Marquer les 54 changesets comme deja executes
INSERT INTO DATABASECHANGELOG (ID, AUTHOR, FILENAME, DATEEXECUTED, ORDEREXECUTED, EXECTYPE, DESCRIPTION, LIQUIBASE, DEPLOYMENT_ID) VALUES
('0001-add-keycloak-id-to-users', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 1, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0002-fix-intervention-status-constraint', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 2, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0003-fix-existing-intervention-statuses', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 3, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0004-create-portfolio-tables', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 4, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0005-add-portfolio-permissions', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 5, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0006-refactor-users-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 6, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0007-create-manager-team-user-associations', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 7, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0008-create-manager-properties-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 8, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0009-add-missing-permissions', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 9, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0010-add-report-permissions', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 10, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0011-extend-intervention-photos-notes-to-text', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 11, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0012-extend-before-after-photos-urls-to-text', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 12, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0013-add-photo-type-to-intervention-photos', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 13, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0014-add-validated-rooms-to-interventions', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 14, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0015-add-completed-steps-to-interventions', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 15, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0016-create-airbnb-integration-tables', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 16, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0017-create-gdpr-consents-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 17, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0018-prepare-encrypted-columns', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 18, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0019-create-notification-preferences-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 19, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0020-add-billing-period', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 20, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0021-create-reservations-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 21, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0022-create-received-forms-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 22, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0023-add-default-times-to-properties', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 23, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0024-create-contact-messages-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 24, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0025-create-document-templates-tables', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 25, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0026-create-document-generations-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 26, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0027-nf-compliance', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 27, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0028-add-addon-services-to-properties', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 28, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0029-add-amenities-to-properties', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 29, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0030-add-forfait-configs', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 30, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0031-add-service-category-configs', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 31, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0032-seed-default-configs-and-catalogs', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 32, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0033-create-property-teams-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 33, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0034-add-geo-fields-to-properties', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 34, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0035-create-team-coverage-zones-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 35, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0036-create-noise-monitoring-tables', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 36, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0037-create-organization-tables', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 37, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0038-add-orgid-to-airbnb-listing-mappings', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 38, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0039-add-email-hash-and-encrypt-pii', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 39, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0040-create-invitations-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 40, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0041-refactor-role-system', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 41, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0042-add-new-team-roles-to-portfolio-teams', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 42, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0043-remove-deprecated-admin-manager-roles', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 43, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0044-add-system-organization-type', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 44, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0045-create-calendar-tables', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 45, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0046-create-outbox-events-table', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 46, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0047-create-guest-rateplan-restriction-tables', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 47, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0048-create-channel-connector-tables', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 48, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0049-create-security-audit-log', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 49, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0050-partition-calendar-days-by-month', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 50, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0051-create-reconciliation-runs', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 51, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0052-create-kpi-snapshots', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 52, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0053-create-guest-messaging-tables', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 53, 'EXECUTED', 'sqlFile', '4.24.0', '0'),
('0054-create-noise-alert-tables', 'clenzy-team', 'db/changelog/db.changelog-master.yaml', NOW(), 54, 'EXECUTED', 'sqlFile', '4.24.0', '0');

-- 4. Verification
SELECT COUNT(*) AS total_synced FROM DATABASECHANGELOG;
-- Attendu : 54
