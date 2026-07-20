package com.clenzy;

import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * LE test de rejouabilite du changelog (chantier 0000-baseline).
 *
 * <p>Contexte : le changelog a ete converti depuis Flyway V2→V58, le schema
 * initial (ere V1, cree par {@code ddl-auto=update}) n'existait dans aucun
 * changeset et la prod ne tenait que par changelog-sync — aucun environnement
 * neuf n'etait provisionnable depuis le repo. Le changeset
 * {@code 0000-baseline-schema} (precondition {@code onFail=MARK_RAN} si
 * {@code users} existe) comble ce trou. Ce test en est la preuve, dans les
 * deux sens :</p>
 * <ol>
 *   <li><b>Base VIERGE</b> : replay INTEGRAL du master changelog (0000 →
 *       dernier changeset) sur un Postgres pgvector nu, puis validation
 *       Hibernate ({@code hbm2ddl.auto=validate}) de TOUTES les entites
 *       {@code com.clenzy} — exactement le chemin de boot d'un environnement
 *       neuf (DR, staging vierge) ;</li>
 *   <li><b>Base EXISTANTE</b> : sur une base ou {@code users} existe deja
 *       (l'etat de tout environnement reel), le 0000 est marque
 *       {@code MARK_RAN} sans rien executer, et le changeset suivant (0001)
 *       s'applique ensuite comme avant — l'ajout du baseline ne perturbe
 *       aucun boot existant.</li>
 * </ol>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true",
        disabledReason = "Tests d'integration (Docker/Testcontainers) — poser CLENZY_IT=true pour les executer")
class LiquibaseVirginReplayIT {

    private static final String MASTER_CHANGELOG = "db/changelog/db.changelog-master.yaml";
    private static final String BASELINE_ID = "0000-baseline-schema";

    // Container dedie, SANS init script : la base doit etre reellement vierge
    // (meme l'extension pgvector doit venir du changeset 0143).
    static final PostgreSQLContainer<?> postgres;

    static {
        if (AbstractIntegrationTest.IT_ENABLED) {
            postgres = new PostgreSQLContainer<>(
                    DockerImageName.parse("pgvector/pgvector:pg15").asCompatibleSubstituteFor("postgres"))
                    .withDatabaseName("virgin_replay")
                    .withUsername("test")
                    .withPassword("test");
            postgres.start();
        } else {
            postgres = null;
        }
    }

    // ── 1. Base vierge : replay integral + validation Hibernate ───────────────

    @Test
    void virginDatabase_fullReplayThenHibernateValidate() throws Exception {
        String url = postgres.getJdbcUrl();
        virginReplayDoneOnce();

        try (Connection connection = open(url)) {
            assertEquals("EXECUTED", execType(connection, BASELINE_ID),
                    "Sur base vierge le baseline doit s'executer reellement");
            // Sondes de bout de replay : une table baseline enrichie par les
            // changesets, et une table entierement creee par changeset.
            assertTrue(columnExists(connection, "users", "keycloak_id"), "users.keycloak_id (0001) manquant");
            assertTrue(tableExists(connection, "organizations"), "organizations (0037) manquante");
        }

        // Validation Hibernate de toutes les entites, memes strategies de
        // nommage que Spring Boot (= le ddl-auto:validate du boot prod).
        LocalContainerEntityManagerFactoryBean factory = new LocalContainerEntityManagerFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(
                url + "&stringtype=unspecified", postgres.getUsername(), postgres.getPassword()));
        factory.setPackagesToScan("com.clenzy");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        Map<String, Object> props = new HashMap<>();
        props.put("hibernate.hbm2ddl.auto", "validate");
        props.put("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");
        props.put("hibernate.physical_naming_strategy",
                org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy.class.getName());
        props.put("hibernate.implicit_naming_strategy", SpringImplicitNamingStrategy.class.getName());
        factory.setJpaPropertyMap(props);
        try {
            factory.afterPropertiesSet(); // leve SchemaManagementException si le schema ne valide pas
        } finally {
            factory.destroy();
        }
    }

    // ── 1bis. Checksums : les fichiers historiques revises ne bloquent pas ────

    /**
     * Les changesets 0006/0027/0050 ont ete REVISES par le chantier baseline
     * (meta-commande psql, colonnes ddl-auto, portal pgjdbc) alors qu'ils sont
     * deja appliques partout : leurs checksums stockes en prod datent du
     * changelog-sync et ne correspondent plus aux fichiers. Le
     * {@code validCheckSum: "1:any"} du master changelog doit absorber ce
     * mismatch — sinon CHAQUE boot d'environnement existant echouerait.
     * On simule : checksums stockes alteres + nouvel update → aucun echec,
     * aucune re-execution.
     */
    @Test
    void revisedHistoricalChangesets_oldChecksumsDoNotBreakBoot() throws Exception {
        // Depend de l'etat du replay integral : execute apres coup sur la meme base.
        virginReplayDoneOnce();
        String url = postgres.getJdbcUrl();
        try (Connection connection = open(url);
             Statement st = connection.createStatement()) {
            int touched = st.executeUpdate(
                    "UPDATE databasechangelog SET md5sum = '9:00000000000000000000000000000000' WHERE id IN "
                            + "('0006-refactor-users-table', '0027-nf-compliance', '0050-partition-calendar-days-by-month')");
            assertEquals(3, touched, "Les 3 changesets revises doivent etre dans databasechangelog");
        }
        // Simule le boot suivant d'un environnement existant : ne doit ni
        // echouer sur les checksums ni re-executer quoi que ce soit.
        try (Connection connection = open(url)) {
            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try (Liquibase liquibase = new Liquibase(
                    MASTER_CHANGELOG, new ClassLoaderResourceAccessor(), database)) {
                // Contexte `!rls` : reflete le deploiement par defaut (dev/test/prod)
                // ou le changeset RLS 0345 (contexte `rls`) reste dormant.
                liquibase.update("!rls");
            }
        }
        try (Connection connection = open(url)) {
            assertEquals("EXECUTED", execType(connection, "0006-refactor-users-table"),
                    "Le changeset revise ne doit pas etre re-execute (exectype inchange)");
        }
    }

    private static volatile boolean replayDone;

    private synchronized void virginReplayDoneOnce() throws Exception {
        if (replayDone) {
            return;
        }
        try (Connection connection = open(postgres.getJdbcUrl())) {
            if (!tableExists(connection, "databasechangelog")
                    || execType(connection, BASELINE_ID) == null) {
                Database database = DatabaseFactory.getInstance()
                        .findCorrectDatabaseImplementation(new JdbcConnection(connection));
                try (Liquibase liquibase = new Liquibase(
                        MASTER_CHANGELOG, new ClassLoaderResourceAccessor(), database)) {
                    // `!rls` : deploiement par defaut, changeset RLS 0345 dormant.
                    liquibase.update("!rls");
                }
            }
        }
        replayDone = true;
    }

    // ── 2. Base existante : baseline MARK_RAN, suite inchangee ────────────────

    @Test
    void existingDatabase_baselineIsMarkRanAndNextChangesetsStillApply() throws Exception {
        // Base separee simulant un environnement existant : users est deja la
        // (tous les environnements reels ont ete crees par ddl-auto historique).
        try (Connection admin = open(postgres.getJdbcUrl());
             Statement st = admin.createStatement()) {
            st.execute("CREATE DATABASE existing_env");
        }
        String url = postgres.getJdbcUrl().replace("/virgin_replay", "/existing_env");

        try (Connection connection = open(url);
             Statement st = connection.createStatement()) {
            st.execute("CREATE TABLE users (id bigint primary key)");
        }

        try (Connection connection = open(url)) {
            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try (Liquibase liquibase = new Liquibase(
                    MASTER_CHANGELOG, new ClassLoaderResourceAccessor(), database)) {
                // 0000 (MARK_RAN attendu) puis 0001 (doit s'appliquer comme avant)
                liquibase.update(2, "");
            }
        }

        try (Connection connection = open(url)) {
            assertEquals("MARK_RAN", execType(connection, BASELINE_ID),
                    "users existe deja : le baseline ne doit RIEN executer");
            assertFalse(tableExists(connection, "properties"),
                    "MARK_RAN ne doit creer aucune table du baseline");
            assertEquals("EXECUTED", execType(connection, "0001-add-keycloak-id-to-users"),
                    "Le changeset suivant doit s'appliquer normalement apres le MARK_RAN");
            assertTrue(columnExists(connection, "users", "keycloak_id"),
                    "0001 doit avoir reellement modifie users");
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private Connection open(String url) throws Exception {
        return DriverManager.getConnection(url, postgres.getUsername(), postgres.getPassword());
    }

    private String execType(Connection connection, String changeSetId) throws Exception {
        try (var ps = connection.prepareStatement(
                "SELECT exectype FROM databasechangelog WHERE id = ?")) {
            ps.setString(1, changeSetId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    private boolean tableExists(Connection connection, String table) throws Exception {
        try (var ps = connection.prepareStatement(
                "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private boolean columnExists(Connection connection, String table, String column) throws Exception {
        try (var ps = connection.prepareStatement(
                "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'"
                        + " AND table_name = ? AND column_name = ?")) {
            ps.setString(1, table);
            ps.setString(2, column);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }
}
