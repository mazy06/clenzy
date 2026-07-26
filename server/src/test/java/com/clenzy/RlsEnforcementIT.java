package com.clenzy;

import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifie que la Row-Level Security multi-tenant (changeset {@code 0345}, contexte
 * Liquibase {@code rls}) isole reellement les organisations <b>au niveau base</b>.
 *
 * <h2>Pourquoi ce test existe</h2>
 * <p>Audit 2026-07 (P1-22 / F1-STRUCT) : aucune defense en profondeur n'est active en
 * production — le filtre Hibernate {@code organizationFilter} est inerte sur les flux HTTP
 * et la RLS est doublement desactivee. L'isolation repose donc sur une garde applicative
 * ecrite a la main dans chaque endpoint, et cet audit y a trouve plusieurs oublis.</p>
 *
 * <p>La conception d'origine prevoyait un rollout « staging-first »
 * ({@code RLS-ROLLOUT-RUNBOOK.md}, contexte {@code rls} active uniquement par
 * {@code application-staging.yml}). <b>Il n'existe pas de staging</b> (local + production
 * seulement) : la validation se fait donc ici, sur Testcontainers — reproductible, rejoue a
 * chaque PR, et sans infrastructure a maintenir.</p>
 *
 * <h2>Le piege que ce test evite</h2>
 * <p>Un test RLS execute avec l'utilisateur par defaut de Testcontainers ne prouverait
 * <b>rien</b> : ce role est SUPERUSER, et un superuser contourne toujours la RLS, y compris
 * avec {@code FORCE ROW LEVEL SECURITY}. Ce test cree donc un role applicatif
 * <b>non-superuser</b> et s'y connecte. {@link #superuserBypassesRls_documentsPrerequisite()}
 * verrouille ce raisonnement en prouvant l'inverse pour le superuser — c'est la traduction
 * executable du prerequis REM-T-02 (le compte applicatif de production est aujourd'hui
 * superuser, cf. P4-03 : activer la RLS sans changer de compte serait sans effet).</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true",
        disabledReason = "Tests d'integration (Docker/Testcontainers) — poser CLENZY_IT=true pour les executer")
class RlsEnforcementIT {

    private static final String MASTER_CHANGELOG = "db/changelog/db.changelog-master.yaml";

    /** Tables couvertes par le changeset 0345. */
    private static final String[] RLS_TABLES = {
            "reservations", "invoices", "document_generations", "service_requests", "payment_transactions"};

    private static final String APP_ROLE = "clenzy_app_rls";
    private static final String APP_PASSWORD = "app-rls-test";

    private static final long ORG_A = 9001L;
    private static final long ORG_B = 9002L;

    static final PostgreSQLContainer<?> postgres;

    static {
        if (AbstractIntegrationTest.IT_ENABLED) {
            postgres = new PostgreSQLContainer<>(
                    DockerImageName.parse("pgvector/pgvector:pg15").asCompatibleSubstituteFor("postgres"))
                    .withDatabaseName("rls_enforcement")
                    .withUsername("test")
                    .withPassword("test");
            postgres.start();
        } else {
            postgres = null;
        }
    }

    @BeforeAll
    static void applyMigrationsWithRlsAndSeed() throws Exception {
        try (Connection admin = openAsSuperuser()) {
            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(admin));
            try (Liquibase liquibase = new Liquibase(
                    MASTER_CHANGELOG, new ClassLoaderResourceAccessor(), database)) {
                // Contexte `rls` : le changeset 0345 s'applique (contrairement au defaut `!rls`).
                liquibase.update("rls");
            }
        }

        try (Connection admin = openAsSuperuser(); Statement st = admin.createStatement()) {
            // Role applicatif NON-superuser : c'est la cible de REM-T-02, et la seule
            // configuration dans laquelle la RLS a un effet.
            st.execute("DROP ROLE IF EXISTS " + APP_ROLE);
            st.execute("CREATE ROLE " + APP_ROLE + " LOGIN PASSWORD '" + APP_PASSWORD + "'");
            st.execute("GRANT USAGE ON SCHEMA public TO " + APP_ROLE);
            st.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO " + APP_ROLE);
            st.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO " + APP_ROLE);

            // Une transaction par organisation, inserees en superuser (donc hors RLS).
            insertPaymentTransaction(st, 900001L, ORG_A, "TX-ORG-A");
            insertPaymentTransaction(st, 900002L, ORG_B, "TX-ORG-B");
        }
    }

    // ── 1. La RLS est bien posee et FORCEE ───────────────────────────────────

    @Test
    @DisplayName("les 5 tables prioritaires ont la RLS activee ET forcee")
    void priorityTables_haveRlsEnabledAndForced() throws Exception {
        try (Connection admin = openAsSuperuser(); Statement st = admin.createStatement()) {
            for (String table : RLS_TABLES) {
                try (ResultSet rs = st.executeQuery(
                        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class "
                                + "WHERE oid = '" + table + "'::regclass")) {
                    assertThat(rs.next()).as("table %s introuvable", table).isTrue();
                    assertThat(rs.getBoolean(1)).as("%s : RLS non activee", table).isTrue();
                    // FORCE est indispensable : sans lui, le proprietaire de la table
                    // (l'application) ne serait pas soumis a la policy.
                    assertThat(rs.getBoolean(2)).as("%s : RLS non FORCEE", table).isTrue();
                }
            }
        }
    }

    // ── 2. Comportement du role applicatif non-superuser ─────────────────────

    @Test
    @DisplayName("sans contexte tenant, aucune ligne n'est visible (fail-closed)")
    void withoutTenantGuc_returnsNoRow() throws Exception {
        try (Connection app = openAsAppRole(); Statement st = app.createStatement()) {
            assertThat(countTransactions(st))
                    .as("aucune GUC posee ⇒ la policy ne matche rien ⇒ fail-closed")
                    .isZero();
        }
    }

    @Test
    @DisplayName("avec app.current_org, seules les lignes de cette organisation sont visibles")
    void withTenantGuc_returnsOnlyOwnOrganization() throws Exception {
        try (Connection app = openAsAppRole(); Statement st = app.createStatement()) {
            st.execute("SELECT set_config('app.current_org', '" + ORG_A + "', false)");

            assertThat(countTransactions(st)).isEqualTo(1);
            try (ResultSet rs = st.executeQuery(
                    "SELECT organization_id FROM payment_transactions")) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getLong(1))
                        .as("la ligne de l'organisation B ne doit jamais remonter")
                        .isEqualTo(ORG_A);
            }
        }
    }

    /**
     * Le coeur du sujet : meme en demandant explicitement l'identifiant d'une ligne d'une
     * autre organisation — ce que fait un {@code findById} non garde — la base ne renvoie
     * rien. C'est la defense en profondeur qui manque aujourd'hui en production.
     */
    @Test
    @DisplayName("un findById cross-organisation ne renvoie rien, garde applicative ou non")
    void crossOrganizationLookupById_returnsNothing() throws Exception {
        try (Connection app = openAsAppRole(); Statement st = app.createStatement()) {
            st.execute("SELECT set_config('app.current_org', '" + ORG_A + "', false)");

            try (ResultSet rs = st.executeQuery(
                    "SELECT id FROM payment_transactions WHERE id = 900002")) {
                assertThat(rs.next())
                        .as("l'identifiant appartient a l'organisation B : la RLS doit l'occulter")
                        .isFalse();
            }
        }
    }

    @Test
    @DisplayName("app.bypass_rls=on rend toutes les lignes visibles (staff plateforme)")
    void bypassGuc_returnsAllRows() throws Exception {
        try (Connection app = openAsAppRole(); Statement st = app.createStatement()) {
            st.execute("SELECT set_config('app.bypass_rls', 'on', false)");

            assertThat(countTransactions(st))
                    .as("le bypass est la voie prevue pour SUPER_ADMIN / org SYSTEM")
                    .isEqualTo(2);
        }
    }

    @Test
    @DisplayName("WITH CHECK : ecrire pour une autre organisation est refuse")
    void writingForAnotherOrganization_isRejected() throws Exception {
        try (Connection app = openAsAppRole(); Statement st = app.createStatement()) {
            st.execute("SELECT set_config('app.current_org', '" + ORG_A + "', false)");

            assertThatThrownBy(() -> insertPaymentTransaction(st, 900003L, ORG_B, "TX-FORGE"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("row-level security");
        }
    }

    // ── 3. Prerequis REM-T-02, prouve plutot qu'affirme ──────────────────────

    /**
     * En production, l'application se connecte avec le <b>superuser</b> PostgreSQL
     * (audit P4-03 : un seul compte pour l'application, Liquibase, Keycloak, pgbouncer et
     * la replication). Ce test montre que dans cette configuration la RLS est <b>sans
     * aucun effet</b>, meme posee et forcee : activer le contexte {@code rls} sans creer
     * au prealable un role non-superuser donnerait une fausse impression de securite.
     */
    @Test
    @DisplayName("un superuser contourne la RLS — d'ou le prerequis d'un role dedie (REM-T-02)")
    void superuserBypassesRls_documentsPrerequisite() throws Exception {
        try (Connection admin = openAsSuperuser(); Statement st = admin.createStatement()) {
            st.execute("SELECT set_config('app.current_org', '" + ORG_A + "', false)");

            assertThat(countTransactions(st))
                    .as("le superuser voit les 2 organisations malgre app.current_org=A : "
                            + "la RLS ne protege QUE les roles non-superuser")
                    .isEqualTo(2);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static Connection openAsSuperuser() throws SQLException {
        return DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private static Connection openAsAppRole() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), APP_ROLE, APP_PASSWORD);
    }

    private static int countTransactions(Statement st) throws SQLException {
        try (ResultSet rs = st.executeQuery("SELECT count(*) FROM payment_transactions")) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private static void insertPaymentTransaction(Statement st, long id, long orgId, String ref)
            throws SQLException {
        st.executeUpdate(
                "INSERT INTO payment_transactions "
                        + "(id, organization_id, transaction_ref, amount, currency, status, "
                        + " payment_type, provider_type) "
                        + "VALUES (" + id + ", " + orgId + ", '" + ref + "', 100.00, 'EUR', "
                        + "'PENDING', 'RESERVATION', 'STRIPE')");
    }
}
