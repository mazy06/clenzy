package com.clenzy.integration.oauth;

import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.integration.airbnb.service.AirbnbOAuthService;
import com.clenzy.integration.airbnb.service.AirbnbTokenEncryptionService;
import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.integration.homeaway.service.HomeAwayOAuthService;
import com.clenzy.integration.minut.config.MinutConfig;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.repository.MinutConnectionRepository;
import com.clenzy.integration.minut.service.MinutOAuthService;
import com.clenzy.integration.netatmo.config.NetatmoConfig;
import com.clenzy.integration.netatmo.model.NetatmoConnection;
import com.clenzy.integration.netatmo.repository.NetatmoConnectionRepository;
import com.clenzy.integration.netatmo.service.NetatmoOAuthService;
import com.clenzy.integration.netatmo.service.NetatmoPlatformConfigService;
import com.clenzy.service.AuditLogService;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.EntityManagerFactoryUtils;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.vendor.HibernateJpaDialect;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vrais services, entités JPA, gestionnaire de transactions et verrous PostgreSQL ; HTTP simulé. */
@EnabledIfSystemProperty(named = "baitly.test.jdbc", matches = "jdbc:postgresql:.*")
class BaitlyNativeOAuthCoordinationPostgresTest {
    record Harness(Runnable refresh, Runnable exchange, Runnable revoke, Supplier<String> token) {}
    SessionFactory factory;
    JdbcTemplate admin;
    DriverManagerDataSource source;
    BaitlyOAuthConnectionGuard first, second;
    Object initial;
    Long id;
    String schema;
    final AtomicBoolean staleOnce = new AtomicBoolean();

    @BeforeEach void setup() {
        String url = System.getProperty("baitly.test.jdbc");
        if (!url.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[a-zA-Z0-9_]*(?:test|recipe|ci)[a-zA-Z0-9_]*")
                && !url.equals("jdbc:postgresql://127.0.0.1:55439/postgres")) {
            throw new IllegalArgumentException("Base de recette locale dédiée requise");
        }
        admin = new JdbcTemplate(new DriverManagerDataSource(url, "postgres", ""));
        schema = "baitly_native_oauth_" + UUID.randomUUID().toString().replace("-", "");
        admin.execute("CREATE SCHEMA " + schema);
        source = new DriverManagerDataSource(url + "?currentSchema=" + schema, "postgres", "");
        com.clenzy.integration.oauth.BaitlyOAuthTestGuards.installRefreshJournal(source);
        var config = new Configuration().addAnnotatedClass(AirbnbConnection.class).addAnnotatedClass(HomeAwayConnection.class)
                .addAnnotatedClass(MinutConnection.class).addAnnotatedClass(NetatmoConnection.class)
                .setProperty("hibernate.hbm2ddl.auto", "create-drop");
        config.getProperties().put("hibernate.connection.datasource", source);
        factory = config.buildSessionFactory();
        first = guard(); second = guard();
    }

    BaitlyOAuthConnectionGuard guard() {
        var manager = new JpaTransactionManager(factory);
        manager.setDataSource(source);
        manager.setJpaDialect(new HibernateJpaDialect());
        manager.afterPropertiesSet();
        return new BaitlyOAuthConnectionGuard(new JdbcTemplate(source), manager);
    }

    @AfterEach void close() {
        if (factory != null) factory.close();
        if (admin != null && schema != null) admin.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
    }

    void seed(String provider) {
        initial = switch (provider) {
            case "airbnb" -> new AirbnbConnection();
            case "homeaway" -> new HomeAwayConnection();
            case "minut" -> new MinutConnection();
            default -> new NetatmoConnection();
        };
        if (!provider.equals("homeaway")) ReflectionTestUtils.setField(initial, "userId", "synthetic-user");
        ReflectionTestUtils.setField(initial, "organizationId", 7L);
        ReflectionTestUtils.setField(initial, "accessTokenEncrypted", "encrypted-old-access");
        ReflectionTestUtils.setField(initial, "refreshTokenEncrypted", "encrypted-old-refresh");
        ReflectionTestUtils.setField(initial, "tokenExpiresAt", LocalDateTime.now().minusHours(1));
        try (var em = factory.createEntityManager()) {
            em.getTransaction().begin(); em.persist(initial); em.getTransaction().commit();
        }
        id = (Long) ReflectionTestUtils.getField(initial, "id");
    }

    Object read() {
        EntityManager em = EntityManagerFactoryUtils.getTransactionalEntityManager(factory);
        if (em != null) return em.find(initial.getClass(), id);
        if (staleOnce.compareAndSet(true, false)) return initial;
        try (var independent = factory.createEntityManager()) { return independent.find(initial.getClass(), id); }
    }

    <T> T save(T connection) {
        var em = EntityManagerFactoryUtils.getTransactionalEntityManager(factory);
        assertThat(em).as("Repository must participate in guarded JPA transaction").isNotNull();
        return em.merge(connection);
    }

    <T> T locked(String provider, Supplier<T> operation) {
        return provider.equals("homeaway") ? second.execute(provider, 7L, operation)
                : second.executeForUser(provider, "synthetic-user", operation);
    }

    Harness harness(String provider, RestTemplate http, BaitlyOAuthConnectionGuard guard) {
        var redis = mock(StringRedisTemplate.class);
        var audit = mock(AuditLogService.class);
        if (provider.equals("airbnb") || provider.equals("homeaway")) {
            var crypto = mock(AirbnbTokenEncryptionService.class);
            when(crypto.decrypt(anyString())).thenAnswer(call -> call.<String>getArgument(0).replace("encrypted-", ""));
            when(crypto.encrypt(anyString())).thenAnswer(call -> "encrypted-" + call.getArgument(0));
            if (provider.equals("airbnb")) {
                var config = mock(AirbnbConfig.class);
                when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
                when(config.getApiBaseUrl()).thenReturn("https://oauth.example.invalid");
                var repo = mock(AirbnbConnectionRepository.class);
                when(repo.findByUserId("synthetic-user")).thenAnswer(call -> Optional.of((AirbnbConnection) read()));
                when(repo.save(any())).thenAnswer(call -> save(call.getArgument(0)));
                var service = new AirbnbOAuthService(config, repo, crypto, audit, redis, http, guard);
                return new Harness(() -> service.refreshToken("synthetic-user"),
                        () -> service.exchangeCodeForToken("synthetic-code", "synthetic-user"),
                        () -> service.revokeToken("synthetic-user"), () -> service.getValidAccessToken("synthetic-user"));
            }
            var config = mock(HomeAwayConfig.class);
            when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
            var repo = mock(HomeAwayConnectionRepository.class);
            when(repo.findByOrganizationId(7L)).thenAnswer(call -> Optional.of((HomeAwayConnection) read()));
            when(repo.save(any())).thenAnswer(call -> save(call.getArgument(0)));
            var service = new HomeAwayOAuthService(config, repo, crypto, audit, redis, http, guard);
            return new Harness(() -> service.refreshToken(7L), () -> service.exchangeCodeForToken("synthetic-code", 7L),
                    () -> {}, () -> service.getValidAccessToken(7L));
        }
        var crypto = mock(TokenEncryptionService.class);
        when(crypto.decrypt(anyString())).thenAnswer(call -> call.<String>getArgument(0).replace("encrypted-", ""));
        when(crypto.encrypt(anyString())).thenAnswer(call -> "encrypted-" + call.getArgument(0));
        var tenant = mock(TenantContext.class);
        if (provider.equals("minut")) {
            var config = mock(MinutConfig.class);
            when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
            when(config.getApiBaseUrl()).thenReturn("https://oauth.example.invalid");
            var repo = mock(MinutConnectionRepository.class);
            when(repo.findByUserId("synthetic-user")).thenAnswer(call -> Optional.of((MinutConnection) read()));
            when(repo.save(any())).thenAnswer(call -> save(call.getArgument(0)));
            var service = new MinutOAuthService(config, repo, crypto, tenant, redis, http, guard);
            return new Harness(() -> service.refreshToken((MinutConnection) initial),
                    () -> service.exchangeCodeForToken("synthetic-code", "synthetic-user"),
                    () -> service.revokeToken("synthetic-user"), () -> service.getValidAccessToken("synthetic-user"));
        }
        var config = mock(NetatmoConfig.class);
        when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
        var repo = mock(NetatmoConnectionRepository.class);
        when(repo.findByUserId("synthetic-user")).thenAnswer(call -> Optional.of((NetatmoConnection) read()));
        when(repo.save(any())).thenAnswer(call -> save(call.getArgument(0)));
        var service = new NetatmoOAuthService(config, mock(NetatmoPlatformConfigService.class), repo, crypto, tenant, redis, http, guard);
        return new Harness(() -> service.refreshToken((NetatmoConnection) initial),
                () -> service.exchangeCodeForToken("synthetic-code", "synthetic-user", 7L),
                () -> service.revokeToken("synthetic-user"), () -> service.getValidAccessToken("synthetic-user"));
    }

    @ParameterizedTest @ValueSource(strings = {"airbnb", "homeaway", "minut", "netatmo"})
    void competingMutationsCannotReuseRotatingRefreshToken(String provider) throws Exception {
        seed(provider);
        var http = mock(RestTemplate.class);
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(http.postForEntity(anyString(), any(), eq(Map.class))).thenAnswer(call -> {
            assertThat(new JdbcTemplate(source).queryForObject("SELECT count(*) FROM baitly_oauth_refresh_attempts", Long.class)).isEqualTo(1);
            Object body = call.getArgument(1);
            if (body instanceof HttpEntity<?> entity) body = entity.getBody();
            assertThat(body.toString()).contains("old-refresh");
            entered.countDown(); BaitlyOAuthCoordinationPostgresTest.await(release);
            return ResponseEntity.ok(Map.of("access_token", "new-access", "refresh_token", "new-refresh", "expires_in", 3600));
        });
        var firstService = harness(provider, http, first);
        var secondService = harness(provider, http, second);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var pending = executor.submit(firstService.refresh());
            try {
                BaitlyOAuthCoordinationPostgresTest.await(entered);
                assertThatThrownBy(secondService.refresh()::run).hasMessageContaining("déjà en cours");
                assertThatThrownBy(secondService.exchange()::run).hasMessageContaining("déjà en cours");
                if (!provider.equals("homeaway")) assertThatThrownBy(secondService.revoke()::run).hasMessageContaining("déjà en cours");
            } finally { release.countDown(); }
            pending.get(10, TimeUnit.SECONDS);
        }
        assertThat(ReflectionTestUtils.getField(read(), "refreshTokenEncrypted")).isEqualTo("encrypted-new-refresh");
        assertThat(secondService.token().get()).isEqualTo("new-access");
        verify(http, times(1)).postForEntity(anyString(), any(), eq(Map.class));
    }

    @ParameterizedTest @ValueSource(strings = {"airbnb", "homeaway", "minut", "netatmo"})
    void staleIncomingConnectionCannotReactivateInactiveRow(String provider) {
        seed(provider);
        locked(provider, () -> {
            Object c = read();
            if (c instanceof AirbnbConnection a) a.setStatus(AirbnbConnection.AirbnbConnectionStatus.REVOKED);
            if (c instanceof HomeAwayConnection h) h.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.INACTIVE);
            if (c instanceof MinutConnection m) m.setStatus(MinutConnection.MinutConnectionStatus.REVOKED);
            if (c instanceof NetatmoConnection n) n.setStatus(NetatmoConnection.NetatmoConnectionStatus.REVOKED);
            return null;
        });
        var http = mock(RestTemplate.class);
        var service = harness(provider, http, first);
        assertThatThrownBy(service.refresh()::run).hasMessageContaining("inactive");
        assertThat(ReflectionTestUtils.getField(read(), "status").toString()).isIn("REVOKED", "INACTIVE");
        verifyNoInteractions(http);
    }

    @ParameterizedTest @ValueSource(strings = {"airbnb", "homeaway", "minut", "netatmo"})
    void uncertainExplicitRefreshCannotRepeatAndOnlyNewAuthorizationClearsIt(String provider) {
        seed(provider);
        var http = mock(RestTemplate.class);
        var db = new JdbcTemplate(source);
        when(http.postForEntity(anyString(), any(), eq(Map.class))).thenAnswer(call -> {
            assertThat(db.queryForObject("SELECT count(*) FROM baitly_oauth_refresh_attempts", Long.class)).isEqualTo(1);
            throw new IllegalStateException("synthetic-timeout");
        });
        var one = harness(provider,http,first); var two = harness(provider,http,second);
        assertThatThrownBy(one.refresh()::run).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(two.refresh()::run).hasMessage("Rotation OAuth non confirmée ; reconnexion requise").hasNoCause();
        verify(http,times(1)).postForEntity(anyString(),any(),eq(Map.class));
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_oauth_refresh_attempts", Long.class)).isEqualTo(1);
        doReturn(ResponseEntity.ok(Map.of("access_token","reauthorized-access","refresh_token","reauthorized-refresh","expires_in",3600)))
                .when(http).postForEntity(anyString(),any(),eq(Map.class));
        two.exchange().run();
        assertThat(db.queryForObject("SELECT count(*) FROM baitly_oauth_refresh_attempts", Long.class)).isZero();
        assertThat(two.token().get()).isEqualTo("reauthorized-access");
    }

    @ParameterizedTest @ValueSource(strings = {"airbnb", "homeaway", "minut", "netatmo"})
    void automaticRefreshRechecksDatabaseInsteadOfRefreshingStaleObject(String provider) {
        seed(provider);
        locked(provider, () -> {
            Object c = read();
            ReflectionTestUtils.setField(c, "tokenExpiresAt", LocalDateTime.now().plusHours(1));
            ReflectionTestUtils.setField(c, "accessTokenEncrypted", "encrypted-new-access");
            ReflectionTestUtils.setField(c, "refreshTokenEncrypted", "encrypted-new-refresh");
            return null;
        });
        staleOnce.set(true);
        var http = mock(RestTemplate.class);
        assertThat(harness(provider, http, first).token().get()).isEqualTo("new-access");
        verifyNoInteractions(http);
    }

    @ParameterizedTest @ValueSource(strings = {"airbnb", "homeaway", "minut", "netatmo"})
    void failedExchangePreservesStoredCredentialsAndExistingErrorContract(String provider) {
        seed(provider);
        var http = mock(RestTemplate.class);
        when(http.postForEntity(anyString(), any(), eq(Map.class)))
                .thenThrow(new IllegalStateException("Synthetic provider failure"));
        var service = harness(provider, http, first);
        assertThatThrownBy(service.exchange()::run).isInstanceOf(RuntimeException.class);
        Object saved = read();
        assertThat(ReflectionTestUtils.getField(saved, "accessTokenEncrypted")).isEqualTo("encrypted-old-access");
        assertThat(ReflectionTestUtils.getField(saved, "refreshTokenEncrypted")).isEqualTo("encrypted-old-refresh");
        String expected = provider.equals("airbnb") || provider.equals("homeaway") ? "ERROR" : "ACTIVE";
        assertThat(ReflectionTestUtils.getField(saved, "status").toString()).isEqualTo(expected);
    }
}
