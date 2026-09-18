package com.clenzy;

import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import java.sql.DriverManager;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Rejeu local sans démarrer de conteneur ; crée puis supprime uniquement sa base jetable. */
@EnabledIfSystemProperty(named = "baitly.test.full-replay", matches = "true")
class LiquibaseExistingPostgresTest {
    @Test void fullMasterReplaysThenValidatesHibernateAndSecondBoot() throws Exception {
        String adminUrl = System.getenv("BAITLY_REPLAY_JDBC");
        if (adminUrl == null || !adminUrl.matches("jdbc:postgresql://(127\\.0\\.0\\.[12]|localhost):[0-9]+/postgres")) {
            throw new IllegalArgumentException("Une instance PostgreSQL locale explicite est requise");
        }
        String user = System.getenv("BAITLY_REPLAY_USER");
        String password = System.getenv("BAITLY_REPLAY_PASSWORD");
        String database = "baitly_full_replay_" + UUID.randomUUID().toString().replace("-", "");
        String url = adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + database;
        try (var admin = DriverManager.getConnection(adminUrl, user, password); var statement = admin.createStatement()) {
            statement.execute("CREATE DATABASE " + database);
            try {
                apply(url, user, password);
                int firstCount = count(url, user, password);
                assertThat(firstCount).isGreaterThan(400);
                try (var connection = DriverManager.getConnection(url, user, password); var sql = connection.createStatement()) {
                    try (var rows = sql.executeQuery("SELECT count(*) FROM pg_extension WHERE extname='vector'")) {
                        assertThat(rows.next()).isTrue(); assertThat(rows.getInt(1)).isEqualTo(1);
                    }
                    try (var rows = sql.executeQuery("SELECT count(*) FROM databasechangelog WHERE id='0456-service-quote-cancellations'")) {
                        assertThat(rows.next()).isTrue(); assertThat(rows.getInt(1)).isEqualTo(1);
                    }
                }
                apply(url, user, password);
                assertThat(count(url, user, password)).isEqualTo(firstCount);
                var factory = new LocalContainerEntityManagerFactoryBean();
                factory.setDataSource(new DriverManagerDataSource(url + "?stringtype=unspecified", user, password));
                factory.setPackagesToScan("com.clenzy");
                factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
                factory.setJpaPropertyMap(Map.of(
                        "hibernate.hbm2ddl.auto", "validate",
                        "hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect",
                        "hibernate.physical_naming_strategy", org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy.class.getName(),
                        "hibernate.implicit_naming_strategy", SpringImplicitNamingStrategy.class.getName()));
                try { factory.afterPropertiesSet(); } finally { factory.destroy(); }
            } finally {
                statement.execute("DROP DATABASE " + database + " WITH (FORCE)");
            }
        }
    }
    private void apply(String url, String user, String password) throws Exception {
        try (var connection = DriverManager.getConnection(url, user, password)) {
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try (var liquibase = new Liquibase("db/changelog/db.changelog-master.yaml", new ClassLoaderResourceAccessor(), database)) {
                liquibase.update("!rls");
            }
        }
    }
    private int count(String url, String user, String password) throws Exception {
        try (var connection = DriverManager.getConnection(url, user, password); var sql = connection.createStatement();
             var rows = sql.executeQuery("SELECT count(*) FROM databasechangelog")) {
            rows.next(); return rows.getInt(1);
        }
    }
}
