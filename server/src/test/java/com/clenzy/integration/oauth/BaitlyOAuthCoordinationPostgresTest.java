package com.clenzy.integration.oauth;

import com.clenzy.service.TokenEncryptionService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** PostgreSQL éphémère uniquement : vrais verrous, transactions et stockage, HTTP simulé. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class BaitlyOAuthCoordinationPostgresTest {
    JdbcTemplate db;
    BaitlyOAuthConnectionGuard first, second;
    String table;
    String schema;
    JdbcTemplate admin;

    @BeforeEach void setup() {
        String url = System.getProperty("baitly.test.jdbc");
        if (!url.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*")
                && !url.equals("jdbc:postgresql://127.0.0.1:55439/postgres")) {
            throw new IllegalArgumentException("Base de recette locale dédiée requise");
        }
        admin = new JdbcTemplate(new DriverManagerDataSource(url, "postgres", ""));
        schema = "baitly_oauth_journal_" + UUID.randomUUID().toString().replace("-", "");
        admin.execute("CREATE SCHEMA " + schema);
        var source = new DriverManagerDataSource(url + "?currentSchema=" + schema, "postgres", "");
        BaitlyOAuthTestGuards.installRefreshJournal(source);
        db = new JdbcTemplate(source);
        first = new BaitlyOAuthConnectionGuard(db, new DataSourceTransactionManager(source));
        second = new BaitlyOAuthConnectionGuard(db, new DataSourceTransactionManager(source));
        table = "baitly_oauth_" + UUID.randomUUID().toString().replace("-", "");
        db.execute("CREATE TABLE " + table + " (id bigint primary key, access text, refresh text, status text, expiry timestamptz)");
        db.update("INSERT INTO " + table + " VALUES (7, 'old-access', 'old-refresh', 'ACTIVE', now()-interval '1 hour')");
    }

    @AfterEach void cleanup() { if (admin != null && schema != null) admin.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE"); }

    static void await(CountDownLatch latch) {
        try { if (!latch.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Test synchronization timeout"); }
        catch (InterruptedException failure) { Thread.currentThread().interrupt(); throw new IllegalStateException("Test interrupted"); }
    }

    @Test void rotationFollowedByLocalRollbackSurvivesRestartAndRequiresNewAuthorization() {
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        assertThatThrownBy(() -> first.executeRefresh("test", 7L, () -> {
            calls.incrementAndGet();
            db.update("UPDATE " + table + " SET access='rotated-access',refresh='rotated-refresh' WHERE id=7");
            db.execute("SELECT 1/0");
            return "must-not-succeed";
        })).isInstanceOf(RuntimeException.class);
        assertThat(db.queryForObject("SELECT refresh FROM " + table, String.class)).isEqualTo("old-refresh");
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_oauth_refresh_attempts", Long.class)).isEqualTo(1);
        assertThatThrownBy(() -> second.executeRefresh("test", 7L, () -> {calls.incrementAndGet(); return "unsafe";}))
                .hasMessage("Rotation OAuth non confirmée ; reconnexion requise").hasNoCause();
        assertThatThrownBy(() -> second.requireSettled("test", 7L)).hasNoCause();
        assertThat(calls).hasValue(1);
        assertThat(second.executeAuthorization("test", 7L, () -> {
            db.update("UPDATE " + table + " SET access='reauthorized-access',refresh='reauthorized-refresh' WHERE id=7");
            return "reconnected";
        })).isEqualTo("reconnected");
        second.requireSettled("test", 7L);
        assertThat(db.queryForObject("SELECT refresh FROM " + table, String.class)).isEqualTo("reauthorized-refresh");
    }

    @Test void failedReconnectionCannotClearTheDurableFenceAndAgeNeverRearmsIt() {
        assertThatThrownBy(() -> first.executeRefresh("test", 7L, () -> {throw new IllegalStateException("synthetic");}));
        db.update("UPDATE baitly_oauth_refresh_attempts SET created_at=CURRENT_TIMESTAMP-INTERVAL '100 days'");
        assertThatThrownBy(() -> second.executeAuthorization("test", 7L, () -> {
            db.execute("SELECT 1/0"); return "unsafe";
        }));
        assertThatThrownBy(() -> second.executeRefresh("test", 7L, () -> "unsafe"))
                .hasMessage("Rotation OAuth non confirmée ; reconnexion requise").hasNoCause();
        assertThat(second.executeRefresh("other", 7L, () -> "independent-provider")).isEqualTo("independent-provider");
        assertThat(second.executeRefresh("test", 8L, () -> "independent-organization")).isEqualTo("independent-organization");
    }

    @Test void successfulRefreshCommitsCredentialsAndFenceRemovalAtomically() {
        assertThat(first.executeRefresh("test", 7L, () -> {
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_oauth_refresh_attempts", Long.class)).isEqualTo(1);
            db.update("UPDATE " + table + " SET refresh='new-refresh' WHERE id=7");
            return "ok";
        })).isEqualTo("ok");
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_oauth_refresh_attempts", Long.class)).isZero();
        assertThat(db.queryForObject("SELECT refresh FROM " + table, String.class)).isEqualTo("new-refresh");
    }

    @Test void newGrantRemoteSuccessThenLocalRollbackBlocksOldCredentialsAcrossRestart() {
        var remoteCalls = new java.util.concurrent.atomic.AtomicInteger();
        assertThatThrownBy(() -> first.executeAuthorization("test",7L,() -> {
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_oauth_refresh_attempts",Long.class)).isEqualTo(1);
            remoteCalls.incrementAndGet();
            db.update("UPDATE " + table + " SET refresh='new-grant-refresh' WHERE id=7");
            db.execute("SELECT 1/0");
            return "unsafe";
        })).isInstanceOf(RuntimeException.class);
        assertThat(db.queryForObject("SELECT refresh FROM " + table,String.class)).isEqualTo("old-refresh");
        assertThatThrownBy(() -> second.requireSettled("test",7L)).hasNoCause();
        assertThatThrownBy(() -> second.executeRefresh("test",7L,() -> { remoteCalls.incrementAndGet(); return "unsafe"; })).hasNoCause();
        assertThat(remoteCalls).hasValue(1);
        second.executeAuthorization("test",7L,() -> {
            db.update("UPDATE " + table + " SET refresh='confirmed-grant-refresh' WHERE id=7");
            return "ok";
        });
        second.requireSettled("test",7L);
    }

    @Test void revocationRollbackBlocksOldTokensAndLocalWritesCannotUnblockThem() {
        assertThatThrownBy(() -> first.executeRevocation("test",7L,() -> {
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_oauth_refresh_attempts",Long.class)).isEqualTo(1);
            db.update("UPDATE " + table + " SET status='REVOKED',access=NULL,refresh=NULL WHERE id=7");
            db.execute("SELECT 1/0");
            return null;
        })).isInstanceOf(RuntimeException.class);
        assertThat(db.queryForObject("SELECT status FROM " + table,String.class)).isEqualTo("ACTIVE");
        second.execute("test",7L,() -> { db.update("UPDATE " + table + " SET access='manual-access' WHERE id=7"); return null; });
        assertThatThrownBy(() -> second.requireSettled("test",7L)).hasNoCause();
        assertThatThrownBy(() -> second.executeRefresh("test",7L,() -> "unsafe")).hasNoCause();
        second.executeRevocation("test",7L,() -> {
            db.update("UPDATE " + table + " SET status='REVOKED',access=NULL,refresh=NULL WHERE id=7"); return null;
        });
        assertThatThrownBy(() -> first.requireSettled("test",7L)).hasNoCause();
        second.executeAuthorization("test",7L,() -> "explicit-confirmed-authorization");
        first.requireSettled("test",7L);
    }

    @Test void grantCannotReplaceAnIntentWhileAnotherInstanceOwnsTheScope() throws Exception {
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var pending = executor.submit(() -> first.executeAuthorization("test",7L,() -> {
                var attempt = db.queryForObject("SELECT attempt FROM baitly_oauth_refresh_attempts",UUID.class);
                entered.countDown(); await(release);
                assertThat(db.queryForObject("SELECT attempt FROM baitly_oauth_refresh_attempts",UUID.class)).isEqualTo(attempt);
                return "ok";
            }));
            try {
                await(entered);
                assertThatThrownBy(() -> second.executeAuthorization("test",7L,() -> "unsafe")).isInstanceOf(BaitlyOAuthBusyException.class);
                assertThatThrownBy(() -> second.executeRevocation("test",7L,() -> "unsafe")).isInstanceOf(BaitlyOAuthBusyException.class);
            } finally { release.countDown(); }
            assertThat(pending.get(10,TimeUnit.SECONDS)).isEqualTo("ok");
        }
        second.requireSettled("test",7L);
    }

    @Test void userScopeFenceHasNoRawIdentityAndCannotBeClearedByAnotherUser() {
        assertThatThrownBy(() -> first.executeUserRefresh("minut", "synthetic-private@example.invalid", () -> {throw new IllegalStateException("synthetic");}));
        assertThat(db.queryForObject("SELECT scope_hash FROM baitly_oauth_refresh_attempts", String.class)).matches("[a-f0-9]{64}");
        second.executeUserAuthorization("minut", "other-user", () -> "ok");
        assertThatThrownBy(() -> second.requireUserSettled("minut", "synthetic-private@example.invalid")).hasNoCause();
        second.executeUserAuthorization("minut", "synthetic-private@example.invalid", () -> "ok");
        second.requireUserSettled("minut", "synthetic-private@example.invalid");
    }

    @Test void refreshJournalMigrationIsRegisteredAndReplaysThroughLiquibase() throws Exception {
        db.execute("DROP TABLE baitly_oauth_refresh_attempts");
        for (int run=0; run<2; run++) {
            try (var connection = db.getDataSource().getConnection()) {
                var database = liquibase.database.DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new liquibase.database.jvm.JdbcConnection(connection));
                var resources = new liquibase.resource.ClassLoaderResourceAccessor();
                try (var master = new liquibase.Liquibase("db/changelog/db.changelog-master.yaml", resources, database)) {
                    var selected = new liquibase.changelog.DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                    master.getDatabaseChangeLog().getChangeSets().stream().filter(change -> change.getId().equals("0598-baitly-oauth-refresh-attempts")).forEach(selected::addChangeSet);
                    assertThat(selected.getChangeSets()).hasSize(1);
                    new liquibase.Liquibase(selected, resources, database).update("");
                }
            }
        }
        assertThat(first.executeRefresh("test", 7L, () -> "migrated")).isEqualTo("migrated");
    }

    @Test void independentGuardsExcludeSameScopeAndReleaseAfterCommit() throws Exception {
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var pending = executor.submit(() -> first.execute("test", 7L, () -> {
                entered.countDown(); await(release); return "first";
            }));
            try {
                await(entered);
                assertThatThrownBy(() -> second.execute("test", 7L, () -> "must-not-run"))
                        .hasMessageContaining("déjà en cours");
                assertThat(second.execute("test", 8L, () -> "other-org")).isEqualTo("other-org");
                assertThat(second.execute("other", 7L, () -> "other-provider")).isEqualTo("other-provider");
            } finally { release.countDown(); }
            assertThat(pending.get(10, TimeUnit.SECONDS)).isEqualTo("first");
            assertThat(second.execute("test", 7L, () -> "after-commit")).isEqualTo("after-commit");
        }
    }

    @Test void exchangeRollsBackButOperationalRefreshErrorCommitsBeforePropagation() {
        assertThatThrownBy(() -> first.execute("test", 7L, () -> {
            db.update("UPDATE " + table + " SET status='REVOKED' WHERE id=7");
            throw new IllegalStateException("synthetic");
        })).hasMessage("synthetic");
        assertThat(db.queryForObject("SELECT status FROM " + table, String.class)).isEqualTo("ACTIVE");
        assertThatThrownBy(() -> second.executeRefresh("test", 7L, () -> {
            db.update("UPDATE " + table + " SET status='ERROR' WHERE id=7");
            throw new IllegalStateException("synthetic");
        })).hasMessage("synthetic");
        assertThat(db.queryForObject("SELECT status FROM " + table, String.class)).isEqualTo("ERROR");
        assertThat(first.execute("test", 7L, () -> "released")).isEqualTo("released");
    }

    @Test void failedDatabaseTransactionCannotReportSuccessOrKeepLock() {
        assertThatThrownBy(() -> first.executeRefresh("test", 7L, () -> {
            db.update("UPDATE " + table + " SET status='ERROR' WHERE id=7");
            db.execute("SELECT 1/0");
            return "must-not-succeed";
        })).isInstanceOf(RuntimeException.class);
        assertThat(db.queryForObject("SELECT status FROM " + table, String.class)).isEqualTo("ACTIVE");
        assertThat(second.execute("test", 7L, () -> "released")).isEqualTo("released");
    }

    @Test void swallowedSqlFailureCannotMakeAbortedPostgresCommitLookSuccessful() {
        assertThatThrownBy(() -> first.executeRefresh("test", 7L, () -> {
            db.update("UPDATE " + table + " SET status='ERROR' WHERE id=7");
            try { db.execute("SELECT 1/0"); }
            catch (org.springframework.dao.DataAccessException ignored) { /* Erreur volontairement avalée. */ }
            return "must-not-succeed";
        })).isInstanceOf(RuntimeException.class);
        assertThat(db.queryForObject("SELECT status FROM " + table, String.class)).isEqualTo("ACTIVE");
        assertThat(second.execute("test", 7L, () -> "released")).isEqualTo("released");
    }

    @Test void competingRefreshAndRevokeCannotUseSameRotatingToken() throws Exception {
        var config = mock(OAuthProviderConfig.class);
        when(config.getProviderKey()).thenReturn("test");
        when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
        when(config.getRefreshTokenValidityDays()).thenReturn(90);
        var crypto = mock(TokenEncryptionService.class);
        when(crypto.decrypt(anyString())).thenAnswer(call -> call.getArgument(0));
        when(crypto.encrypt(anyString())).thenAnswer(call -> call.getArgument(0));
        var http = mock(RestTemplate.class);
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(http.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class))).thenAnswer(call -> {
            HttpEntity<?> request = call.getArgument(2);
            assertThat(request.getBody().toString()).contains("old-refresh");
            entered.countDown(); await(release);
            return ResponseEntity.ok(Map.of("access_token", "new-access", "refresh_token", "new-refresh", "expires_in", 3600));
        });
        var engine1 = new OAuthFlowEngine(mock(OAuthStateService.class), crypto, first);
        var engine2 = new OAuthFlowEngine(mock(OAuthStateService.class), crypto, second);
        ReflectionTestUtils.setField(engine1, "restTemplate", http);
        ReflectionTestUtils.setField(engine2, "restTemplate", http);
        var persistence = persistence();
        try (var executor = Executors.newSingleThreadExecutor()) {
            var pending = executor.submit(() -> engine1.refreshToken(config, persistence, 7L));
            try {
                await(entered);
                assertThatThrownBy(() -> engine2.refreshToken(config, persistence, 7L)).hasMessageContaining("déjà en cours");
                assertThatThrownBy(() -> engine2.revokeToken(config, persistence, 7L)).hasMessageContaining("déjà en cours");
            } finally { release.countDown(); }
            assertThat(pending.get(10, TimeUnit.SECONDS).getRefreshTokenEncrypted()).isEqualTo("new-refresh");
        }
        assertThat(engine2.getValidAccessToken(config, persistence, 7L)).isEqualTo("new-access");
        verify(http, times(1)).exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class));
        engine2.revokeToken(config, persistence, 7L);
        assertThatThrownBy(() -> engine1.refreshToken(config, persistence, 7L))
                .hasMessage("Rotation OAuth non confirmée ; reconnexion requise").hasNoCause();
        verifyNoMoreInteractions(http);
        assertThat(db.queryForObject("SELECT status FROM " + table, String.class)).isEqualTo("REVOKED");
    }

    OAuthConnectionPersistence<OAuthFlowEngineTest.TestConnection> persistence() {
        return new OAuthConnectionPersistence<>() {
            public Optional<OAuthFlowEngineTest.TestConnection> findByOrganizationId(Long org) {
                return db.query("SELECT * FROM " + table + " WHERE id=?", (rs, row) -> {
                    var c = new OAuthFlowEngineTest.TestConnection();
                    c.setOrganizationId(org); c.setUserId(1L);
                    c.setAccessTokenEncrypted(rs.getString("access")); c.setRefreshTokenEncrypted(rs.getString("refresh"));
                    c.setOAuthStatus(OAuthConnectionStatus.valueOf(rs.getString("status")));
                    c.setTokenExpiresAt(rs.getTimestamp("expiry").toInstant());
                    return c;
                }, org).stream().findFirst();
            }
            public Optional<OAuthFlowEngineTest.TestConnection> findActiveByOrganizationId(Long org) {
                return findByOrganizationId(org).filter(c -> c.getOAuthStatus() == OAuthConnectionStatus.ACTIVE);
            }
            public OAuthFlowEngineTest.TestConnection newConnection() { return new OAuthFlowEngineTest.TestConnection(); }
            public OAuthFlowEngineTest.TestConnection save(OAuthFlowEngineTest.TestConnection c) {
                db.update("UPDATE " + table + " SET access=?,refresh=?,status=?,expiry=? WHERE id=?",
                        c.getAccessTokenEncrypted(), c.getRefreshTokenEncrypted(), c.getOAuthStatus().name(),
                        java.sql.Timestamp.from(c.getTokenExpiresAt()), c.getOrganizationId());
                return c;
            }
        };
    }
}
