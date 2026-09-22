package com.clenzy;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.OfflineConnection;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class PlatformUserOrganizationLiquibaseTest {
    private static final String MASTER = "db/changelog/db.changelog-master.yaml";
    private static final String REPAIR = "db/changelog/0479-platform-users-organization.yaml";
    private static final String ID = "0479-platform-users-organization";

    @Test
    void isolatedRepairAndNormalBootHaveSameIdentityAndChecksum() throws Exception {
        try (var resources = new ClassLoaderResourceAccessor()) {
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(
                    new OfflineConnection("offline:postgresql", resources));
            try (var master = new Liquibase(MASTER, resources, database);
                 var repair = new Liquibase(REPAIR, resources, database)) {
                var included = master.getDatabaseChangeLog().getChangeSets().stream()
                        .filter(change -> ID.equals(change.getId())).toList();
                assertThat(included).hasSize(1);
                var standalone = repair.getDatabaseChangeLog().getChangeSets().get(0);
                assertThat(repair.getDatabaseChangeLog().getChangeSets()).hasSize(1);
                assertThat(included.get(0).getFilePath()).isEqualTo(REPAIR);
                assertThat(standalone.getFilePath()).isEqualTo(REPAIR);
                assertThat(included.get(0).getAuthor()).isEqualTo(standalone.getAuthor());
                assertThat(included.get(0).generateCheckSum(liquibase.ChecksumVersion.latest()))
                        .isEqualTo(standalone.generateCheckSum(liquibase.ChecksumVersion.latest()));
            }
        }
    }

    @Test
    @EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql://(localhost|127\\.0\\.0\\.1):[0-9]+/.*")
    void existingTenantUsersSurviveAndPlatformProfileCanBeCreated() throws Exception {
        String adminUrl = System.getProperty("baitly.test.jdbc");
        String user = System.getProperty("baitly.test.user", "postgres");
        String name = "baitly_staff_" + UUID.randomUUID().toString().replace("-", "");
        String url = adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + name;
        try (var admin = DriverManager.getConnection(adminUrl, user, ""); var setup = admin.createStatement()) {
            setup.execute("CREATE DATABASE " + name);
            try {
                try (var connection = DriverManager.getConnection(url, user, ""); var sql = connection.createStatement()) {
                    sql.execute("CREATE TABLE organizations(id bigint PRIMARY KEY)");
                    sql.execute("CREATE TABLE users(id bigint PRIMARY KEY, role text NOT NULL, organization_id bigint NOT NULL REFERENCES organizations(id))");
                    sql.execute("INSERT INTO organizations VALUES (42)");
                    sql.execute("INSERT INTO users VALUES (1,'HOST',42)");
                    assertThatThrownBy(() -> sql.execute("INSERT INTO users VALUES (2,'SUPER_ADMIN',NULL)"))
                            .isInstanceOf(SQLException.class).extracting("SQLState").isEqualTo("23502");
                }
                apply(url, user, false);
                try (var connection = DriverManager.getConnection(url, user, ""); var sql = connection.createStatement()) {
                    sql.execute("INSERT INTO users VALUES (2,'SUPER_ADMIN',NULL)");
                    assertThatThrownBy(() -> sql.execute("INSERT INTO users VALUES (3,'HOST',999)"))
                            .isInstanceOf(SQLException.class).extracting("SQLState").isEqualTo("23503");
                }
                // Next boot parses the real master: it must recognize the isolated execution.
                apply(url, user, true);
                try (var connection = DriverManager.getConnection(url, user, ""); var sql = connection.createStatement()) {
                    try (var rows = sql.executeQuery("SELECT role,organization_id FROM users ORDER BY id")) {
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getString(1)).isEqualTo("HOST");
                        assertThat(rows.getLong(2)).isEqualTo(42);
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getString(1)).isEqualTo("SUPER_ADMIN");
                        assertThat(rows.getObject(2)).isNull();
                        assertThat(rows.next()).isFalse();
                    }
                    try (var rows = sql.executeQuery("SELECT id,filename,exectype FROM databasechangelog")) {
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getString(1)).isEqualTo(ID);
                        assertThat(rows.getString(2)).isEqualTo(REPAIR);
                        assertThat(rows.getString(3)).isEqualTo("EXECUTED");
                        assertThat(rows.next()).isFalse();
                    }
                }
            } finally {
                setup.execute("DROP DATABASE " + name);
            }
        }
    }

    private void apply(String url, String user, boolean fromMaster) throws Exception {
        try (var connection = DriverManager.getConnection(url, user, "");
             var resources = new ClassLoaderResourceAccessor()) {
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try (var source = new Liquibase(fromMaster ? MASTER : REPAIR, resources, database)) {
                var selected = new DatabaseChangeLog(fromMaster ? MASTER : REPAIR);
                source.getDatabaseChangeLog().getChangeSets().stream().filter(change -> ID.equals(change.getId()))
                        .forEach(selected::addChangeSet);
                assertThat(selected.getChangeSets()).hasSize(1);
                var migration = new Liquibase(selected, resources, database);
                migration.update(new Contexts(), new LabelExpression());
                assertThat(migration.listUnrunChangeSets(new Contexts(), new LabelExpression())).isEmpty();
            }
        }
    }
}
