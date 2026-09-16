package com.clenzy.service;

import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Baitly : vrai master parsé, chaîne de disponibilité appliquée dans une base jetable. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class DeclaredAvailabilityLiquibaseTest {
    private static final String MASTER = "db/changelog/db.changelog-master.yaml";
    private static final String AVAILABILITY_ID = "0444-team-declared-availability";

    @Test
    void migrationAppliesOnceAndPreservesAvailabilityAcrossNextBoot() throws Exception {
        String adminUrl = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String databaseName = "baitly_liquibase_" + UUID.randomUUID().toString().replace("-", "");
        // Base dédiée : le SQL de production conserve ses références au schéma public.
        var uri = java.net.URI.create(adminUrl.substring("jdbc:".length()));
        String url = "jdbc:" + new java.net.URI(uri.getScheme(), uri.getUserInfo(), uri.getHost(),
                uri.getPort(), "/" + databaseName, uri.getQuery(), null);
        try (var admin = DriverManager.getConnection(adminUrl, user, "");
             var statement = admin.createStatement()) {
            statement.execute("CREATE DATABASE " + databaseName);
            try {
                try (var connection = DriverManager.getConnection(url, user, "");
                     var sql = connection.createStatement()) {
                    // Seule dépendance de 0401 : la clé de l'équipe. Aucun schéma Hibernate.
                    sql.execute("CREATE TABLE users(id bigint PRIMARY KEY)");
                    sql.execute("INSERT INTO users VALUES (7)");
                    sql.execute("CREATE TABLE team_members(team_id bigint, user_id bigint)");
                    sql.execute("CREATE TABLE teams (id bigint PRIMARY KEY, personal_user_id bigint)");
                    sql.execute("CREATE TABLE marketplace_providers (id bigint PRIMARY KEY, user_id bigint)");
                    sql.execute("CREATE TABLE marketplace_quote_requests(id bigint PRIMARY KEY, marketplace_provider_id bigint, requester_organization_id bigint, provider_team_id bigint, intervention_id bigint, status text, created_at timestamp, quoted_at timestamp, decided_at timestamp)");
                    sql.execute("CREATE TABLE interventions(id bigint PRIMARY KEY, organization_id bigint, status text, assigned_user_id bigint, team_id bigint)");
                    sql.execute("CREATE TABLE marketplace_provider_availability (id bigserial PRIMARY KEY, provider_id bigint, day_of_week smallint, start_time time, end_time time)");
                    sql.execute("CREATE TABLE team_coverage_zones(id bigserial PRIMARY KEY, team_id bigint, country varchar(2), department varchar(3), arrondissement varchar(5), city varchar(100))");
                    sql.execute("CREATE TABLE marketplace_provider_zones(id bigserial PRIMARY KEY, provider_id bigint NOT NULL, country_code varchar(2), department varchar(3), city varchar(80), postal_code varchar(10), radius_km integer, is_primary boolean NOT NULL DEFAULT false, created_at timestamp)");
                    sql.execute("CREATE TABLE marketplace_service_items(id bigint PRIMARY KEY,code varchar(100))");
                    sql.execute("CREATE TABLE marketplace_provider_services(id bigserial PRIMARY KEY,provider_id bigint,category_id bigint,service_item_id bigint,label varchar(120),amount numeric(10,2),pricing_model varchar(20),currency varchar(3),unit_label varchar(40),active boolean DEFAULT true)");
                    sql.execute(java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/db/changelog/changes/0322__technician_prestations.sql")));
                    sql.execute(java.nio.file.Files.readString(java.nio.file.Path.of("src/main/resources/db/changelog/changes/0338__create_housekeeper_rates.sql")));
                    sql.execute("INSERT INTO teams VALUES (1, 7)");
                    sql.execute("INSERT INTO team_coverage_zones(team_id,country,department) VALUES(1,'FR','75')");
                }
                applySelectedMigrations(url, user);
                String checksum;
                try (var connection = DriverManager.getConnection(url, user, "");
                     var sql = connection.createStatement()) {
                    sql.execute("INSERT INTO individual_absences (user_id, start_date, end_date)"
                            + " VALUES (7, DATE '2026-09-15', DATE '2026-09-17')");
                    sql.execute("INSERT INTO marketplace_providers VALUES (1,7)");
                    try (var rows = sql.executeQuery("SELECT "
                            + "public.baitly_provider_covers(1,'FR','75',NULL,NULL),"
                            + "public.baitly_team_covers(1,'FR','75',NULL,NULL),"
                            + "public.baitly_provider_covers(1,'FR','06',NULL,NULL),"
                            + "public.baitly_zone_covers('FR','75','75101',NULL,'FR','75',NULL,NULL),"
                            + "public.baitly_zone_covers('be',NULL,NULL,' Bruxelles ','BE',NULL,NULL,'bruxelles'),"
                            + "public.baitly_zone_covers('BE',NULL,NULL,NULL,'BE',NULL,NULL,NULL)")) {
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getBoolean(1)).isTrue();
                        assertThat(rows.getBoolean(2)).isTrue();
                        assertThat(rows.getBoolean(3)).isFalse();
                        assertThat(rows.getBoolean(4)).isFalse();
                        assertThat(rows.getBoolean(5)).isTrue();
                        assertThat(rows.getBoolean(6)).isFalse();
                    }
                    sql.execute("INSERT INTO interventions VALUES (1,10,'COMPLETED',7,NULL),(2,10,'COMPLETED',99,NULL),(3,10,'PENDING',7,NULL)");
                    sql.execute("INSERT INTO marketplace_quote_requests VALUES "
                        + "(1,1,10,NULL,1,'ACCEPTED','2026-09-16 10:00','2026-09-16 10:10',NULL),"
                        + "(2,1,10,NULL,2,'ACCEPTED','2026-09-16 10:00','2026-09-16 10:20',NULL),"
                        + "(3,1,10,NULL,3,'ACCEPTED','2026-09-16 10:00','2026-09-16 10:30',NULL),"
                        + "(4,1,10,NULL,NULL,'TURNED_DOWN','2026-09-16 10:00',NULL,'2026-09-16 10:40'),"
                        + "(5,1,10,NULL,NULL,'SENT','2026-09-16 10:00',NULL,NULL)");
                    try (var rows = sql.executeQuery("SELECT public.baitly_provider_completed_missions(1), positive_response_pct,response_minutes "
                            + "FROM public.baitly_provider_response_metrics(ARRAY[1]::bigint[])")) {
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getInt(1)).isEqualTo(1);
                        assertThat(rows.getBigDecimal(2)).isEqualByComparingTo("75");
                        assertThat(rows.getInt(3)).isEqualTo(25);
                    }
                    sql.execute("INSERT INTO provider_property_preferences VALUES(7,ARRAY['RIAD'])");
                    try (var rows=sql.executeQuery("SELECT public.baitly_provider_accepts_property(1,'RIAD'),"
                        + "public.baitly_provider_accepts_property(1,'BOAT'),public.baitly_assignee_accepts_property('team',1,'BOAT')")) {
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getBoolean(1)).isTrue();
                        assertThat(rows.getBoolean(2)).isFalse();
                        assertThat(rows.getBoolean(3)).isFalse();
                    }
                    checksum = recordedChecksum(connection);
                    assertAvailability(connection);
                    try (var rows = sql.executeQuery("SELECT prosecdef FROM pg_proc WHERE oid = "
                            + "'public.baitly_team_declared_available(bigint,timestamp,timestamp)'::regprocedure")) {
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getBoolean(1)).as("La fonction conserve SECURITY INVOKER").isFalse();
                    }
                }
                // Nouvelle connexion et nouvelle instance Liquibase, comme au boot suivant.
                applySelectedMigrations(url, user);
                try (var connection = DriverManager.getConnection(url, user, "")) {
                    assertThat(recordedChecksum(connection)).isEqualTo(checksum);
                    assertAvailability(connection);
                    try (var coverage = connection.createStatement(); var rows = coverage.executeQuery(
                            "SELECT user_id, department FROM marketplace_provider_zones")) {
                        assertThat(rows.next()).isTrue(); assertThat(rows.getLong(1)).isEqualTo(7);
                        assertThat(rows.getString(2)).isEqualTo("75"); assertThat(rows.next()).isFalse();
                    }
                    try (var sql = connection.createStatement();
                         var rows = sql.executeQuery("SELECT count(*) FROM databasechangelog")) {
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getInt(1)).isEqualTo(11);
                    }
                    explainSyntheticCatalogue(connection);
                }
            } finally {
                statement.execute("DROP DATABASE " + databaseName);
            }
        }
    }

    /** Mesure locale reproductible ; ne constitue pas une garantie de latence en production. */
    private void explainSyntheticCatalogue(Connection connection) throws Exception {
        try (var sql=connection.createStatement()) {
            sql.execute("SET statement_timeout='60s'");
            sql.execute("INSERT INTO users SELECT generate_series(1000,1999)");
            sql.execute("INSERT INTO marketplace_providers SELECT n,n FROM generate_series(1000,1999) n");
            sql.execute("INSERT INTO marketplace_provider_zones(user_id,country_code,department,is_primary) SELECT n,'FR','75',true FROM generate_series(1000,1999) n");
            sql.execute("INSERT INTO interventions SELECT n,10,'COMPLETED',1000+(n%1000),NULL FROM generate_series(1000,100999) n");
            sql.execute("INSERT INTO marketplace_quote_requests SELECT n,1000+(n%1000),10,NULL,n,'ACCEPTED',timestamp '2026-09-16 10:00',timestamp '2026-09-16 10:30',NULL FROM generate_series(1000,100999) n");
            // Index présent dans la migration 0432, hors de la chaîne minimale de ce test.
            sql.execute("CREATE INDEX idx_quote_provider ON marketplace_quote_requests(marketplace_provider_id,status)");
            sql.execute("ANALYZE");
            var queries=java.util.Map.of(
                "catalog", "SELECT p.id FROM marketplace_providers p WHERE public.baitly_provider_covers(p.id,'FR','75',NULL,NULL) AND public.baitly_provider_accepts_property(p.id,'APARTMENT') ORDER BY public.baitly_provider_completed_missions(p.id) DESC,p.id DESC LIMIT 24",
                "metrics", "SELECT * FROM public.baitly_provider_response_metrics(ARRAY(SELECT generate_series(1000,1023)::bigint))");
            for (var entry:queries.entrySet()) {
                try(var rows=sql.executeQuery("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+entry.getValue())) {
                    assertThat(rows.next()).isTrue();
                    java.nio.file.Files.writeString(java.nio.file.Path.of(System.getProperty("java.io.tmpdir"),
                        "baitly-marketplace-plan-"+entry.getKey()+".json"),rows.getString(1));
                }
            }
        }
    }

    private void applySelectedMigrations(String url, String user) throws Exception {
        try (var connection = DriverManager.getConnection(url, user, "");
             var resources = new ClassLoaderResourceAccessor()) {
            var database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try (var master = new Liquibase(MASTER, resources, database)) {
                // Validation structurelle du master intégral, sans exécuter ses autres migrations.
                master.validate();
                var selected = new DatabaseChangeLog(MASTER);
                for (var changeSet : master.getDatabaseChangeLog().getChangeSets()) {
                    if (changeSet.getId().startsWith("0401-") || changeSet.getId().equals(AVAILABILITY_ID)
                            || changeSet.getId().equals("0445-individual-declared-availability")
                            || changeSet.getId().equals("0448-marketplace-effective-availability")
                            || changeSet.getId().equals("0449-canonical-individual-calendar")
                            || changeSet.getId().equals("0450-canonical-provider-coverage")
                            || changeSet.getId().equals("0451-canonical-provider-tariffs")
                            || changeSet.getId().equals("0452-shared-geographic-eligibility")
                            || changeSet.getId().equals("0453-marketplace-observed-metrics")
                            || changeSet.getId().equals("0454-marketplace-notification-outbox")
                            || changeSet.getId().equals("0455-provider-property-eligibility")) {
                        selected.addChangeSet(changeSet);
                    }
                }
                assertThat(selected.getChangeSets()).hasSize(11);
                // Le master possède et ferme cette connexion partagée une seule fois.
                var migration = new Liquibase(selected, resources, database);
                migration.update("");
            }
        }
    }

    private String recordedChecksum(Connection connection) throws Exception {
        try (var sql = connection.prepareStatement(
                "SELECT md5sum, exectype FROM databasechangelog WHERE id = ?")) {
            sql.setString(1, AVAILABILITY_ID);
            try (var rows = sql.executeQuery()) {
                assertThat(rows.next()).isTrue();
                String checksum = rows.getString(1);
                assertThat(checksum).isNotBlank();
                assertThat(rows.getString(2)).isEqualTo("EXECUTED");
                assertThat(rows.next()).isFalse();
                return checksum;
            }
        }
    }

    private void assertAvailability(Connection connection) throws Exception {
        try (var sql = connection.createStatement()) {
            sql.execute("SET app.bypass_rls = 'off'");
            try (var rows = sql.executeQuery("SELECT "
                    + "public.baitly_team_declared_available(1, timestamp '2026-09-14 22:00', timestamp '2026-09-15 02:00'), "
                    + "public.baitly_team_declared_available(1, timestamp '2026-09-14 22:00', timestamp '2026-09-15 00:00')")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getBoolean(1)).isFalse();
                assertThat(rows.getBoolean(2)).isTrue();
            }
            try (var rows = sql.executeQuery("SELECT current_setting('app.bypass_rls')")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString(1)).isEqualTo("off");
            }
            try (var rows = sql.executeQuery("SELECT public.baitly_user_declared_available(7, timestamp '2026-09-15 09:00', timestamp '2026-09-15 12:00'), "
                    + "public.baitly_user_declared_available(8, timestamp '2026-09-15 09:00', timestamp '2026-09-15 12:00')")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getBoolean(1)).isFalse();
                assertThat(rows.getBoolean(2)).isTrue();
            }
        }
    }
}
