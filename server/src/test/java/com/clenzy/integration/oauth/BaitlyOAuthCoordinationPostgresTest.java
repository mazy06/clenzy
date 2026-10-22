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

    @BeforeEach void setup() {
        String url = System.getProperty("baitly.test.jdbc");
        if (!url.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*")
                && !url.equals("jdbc:postgresql://127.0.0.1:55439/postgres")) {
            throw new IllegalArgumentException("Base de recette locale dédiée requise");
        }
        var source = new DriverManagerDataSource(url, "postgres", "");
        db = new JdbcTemplate(source);
        first = new BaitlyOAuthConnectionGuard(db, new DataSourceTransactionManager(source));
        second = new BaitlyOAuthConnectionGuard(db, new DataSourceTransactionManager(source));
        table = "baitly_oauth_" + UUID.randomUUID().toString().replace("-", "");
        db.execute("CREATE TABLE " + table + " (id bigint primary key, access text, refresh text, status text, expiry timestamptz)");
        db.update("INSERT INTO " + table + " VALUES (7, 'old-access', 'old-refresh', 'ACTIVE', now()-interval '1 hour')");
    }

    @AfterEach void cleanup() { if (db != null && table != null) db.execute("DROP TABLE IF EXISTS " + table); }

    static void await(CountDownLatch latch) {
        try { if (!latch.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Test synchronization timeout"); }
        catch (InterruptedException failure) { Thread.currentThread().interrupt(); throw new IllegalStateException("Test interrupted"); }
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
        assertThatThrownBy(() -> engine1.refreshToken(config, persistence, 7L)).hasMessageContaining("active");
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
