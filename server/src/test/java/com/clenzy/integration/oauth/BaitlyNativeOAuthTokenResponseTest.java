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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.client.RestTemplate;
import java.util.Optional;
import java.util.function.Supplier;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Stream;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.springframework.http.ResponseEntity;

/** Teste les vrais services avec des réponses HTTP synthétiques, sans fournisseur externe. */
class BaitlyNativeOAuthTokenResponseTest {
    record Harness(Class<?> logger, Runnable exchange, Runnable refresh, Supplier<LocalDateTime> expiry,
            Supplier<String> error, Supplier<String> access, Supplier<String> refreshToken, Supplier<String> status) {}

    Harness harness(String provider, RestTemplate http) {
        var redis = mock(StringRedisTemplate.class);
        var audit = mock(AuditLogService.class);
        var tenant = mock(TenantContext.class);
        if (provider.equals("airbnb")) {
            var config = mock(AirbnbConfig.class);
            when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
            when(config.getApiBaseUrl()).thenReturn("https://oauth.example.invalid");
            var repo = mock(AirbnbConnectionRepository.class);
            var crypto = mock(AirbnbTokenEncryptionService.class);
            when(crypto.encrypt(anyString())).thenAnswer(call -> "encrypted-" + call.getArgument(0));
            when(crypto.decrypt(anyString())).thenReturn("synthetic-token");
            var c = new AirbnbConnection();
            c.setId(1L);
            c.setUserId("user-test");
            c.setAccessTokenEncrypted("encrypted-access");
            c.setRefreshTokenEncrypted("encrypted-refresh");
            c.setTokenExpiresAt(LocalDateTime.of(2030, 1, 1, 0, 0));
            c.setStatus(AirbnbConnection.AirbnbConnectionStatus.ERROR);
            when(repo.findByUserId("user-test")).thenReturn(Optional.of(c));
            when(repo.save(any())).thenAnswer(call -> call.getArgument(0));
            var service = new AirbnbOAuthService(config,repo,crypto,audit,redis,http, com.clenzy.integration.oauth.BaitlyOAuthTestGuards.passthrough());
            return new Harness(service.getClass(),() -> service.exchangeCodeForToken("synthetic-code","user-test"),() -> { c.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE); service.refreshToken("user-test"); },
                c::getTokenExpiresAt,c::getErrorMessage,c::getAccessTokenEncrypted,c::getRefreshTokenEncrypted,() -> c.getStatus().name());
        }
        if (provider.equals("homeaway")) {
            var config = mock(HomeAwayConfig.class);
            when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
            var repo = mock(HomeAwayConnectionRepository.class);
            var crypto = mock(AirbnbTokenEncryptionService.class);
            when(crypto.encrypt(anyString())).thenAnswer(call -> "encrypted-" + call.getArgument(0));
            when(crypto.decrypt(anyString())).thenReturn("synthetic-token");
            var c = new HomeAwayConnection();
            c.setId(1L);
            c.setOrganizationId(7L);
            c.setAccessTokenEncrypted("encrypted-access");
            c.setRefreshTokenEncrypted("encrypted-refresh");
            c.setTokenExpiresAt(LocalDateTime.of(2030, 1, 1, 0, 0));
            c.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ERROR);
            when(repo.findByOrganizationId(7L)).thenReturn(Optional.of(c));
            when(repo.save(any())).thenAnswer(call -> call.getArgument(0));
            var service = new HomeAwayOAuthService(config,repo,crypto,audit,redis,http, com.clenzy.integration.oauth.BaitlyOAuthTestGuards.passthrough());
            return new Harness(service.getClass(),() -> service.exchangeCodeForToken("synthetic-code",7L),() -> { c.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE); service.refreshToken(7L); },
                c::getTokenExpiresAt,c::getErrorMessage,c::getAccessTokenEncrypted,c::getRefreshTokenEncrypted,() -> c.getStatus().name());
        }
        var crypto = mock(TokenEncryptionService.class);
        when(crypto.encrypt(anyString())).thenAnswer(call -> "encrypted-" + call.getArgument(0));
        when(crypto.decrypt(anyString())).thenReturn("synthetic-token");
        if (provider.equals("minut")) {
            var config = mock(MinutConfig.class);
            when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
            when(config.getApiBaseUrl()).thenReturn("https://oauth.example.invalid");
            var repo = mock(MinutConnectionRepository.class);
            var c = new MinutConnection();
            c.setUserId("user-test");
            c.setOrganizationId(7L);
            c.setAccessTokenEncrypted("encrypted-access");
            c.setRefreshTokenEncrypted("encrypted-refresh");
            c.setTokenExpiresAt(LocalDateTime.of(2030, 1, 1, 0, 0));
            c.setStatus(MinutConnection.MinutConnectionStatus.ERROR);
            when(repo.findByUserId("user-test")).thenReturn(Optional.of(c));
            when(repo.save(any())).thenAnswer(call -> call.getArgument(0));
            var service = new MinutOAuthService(config,repo,crypto,tenant,redis,http, com.clenzy.integration.oauth.BaitlyOAuthTestGuards.passthrough());
            return new Harness(service.getClass(),() -> service.exchangeCodeForToken("synthetic-code","user-test"),() -> { c.setStatus(MinutConnection.MinutConnectionStatus.ACTIVE); service.refreshToken(c); },c::getTokenExpiresAt,
                c::getErrorMessage,c::getAccessTokenEncrypted,c::getRefreshTokenEncrypted,() -> c.getStatus().name());
        }
        var config = mock(NetatmoConfig.class);
        when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
        var repo = mock(NetatmoConnectionRepository.class);
        var c = new NetatmoConnection();
        c.setUserId("user-test");
        c.setOrganizationId(7L);
        c.setAccessTokenEncrypted("encrypted-access");
        c.setRefreshTokenEncrypted("encrypted-refresh");
        c.setTokenExpiresAt(LocalDateTime.of(2030, 1, 1, 0, 0));
        c.setStatus(NetatmoConnection.NetatmoConnectionStatus.ERROR);
        when(repo.findByUserId("user-test")).thenReturn(Optional.of(c));
        when(repo.save(any())).thenAnswer(call -> call.getArgument(0));
        var service = new NetatmoOAuthService(config,mock(NetatmoPlatformConfigService.class),repo,crypto,tenant,redis,http, com.clenzy.integration.oauth.BaitlyOAuthTestGuards.passthrough());
        return new Harness(service.getClass(),() -> service.exchangeCodeForToken("synthetic-code","user-test",7L),() -> { c.setStatus(NetatmoConnection.NetatmoConnectionStatus.ACTIVE); service.refreshToken(c); },c::getTokenExpiresAt,
            c::getErrorMessage,c::getAccessTokenEncrypted,c::getRefreshTokenEncrypted,() -> c.getStatus().name());
    }

    static Stream<Arguments> invalidResponses() {
        var responses = java.util.List.of(
                Map.<String, Object>of(),
                Map.<String, Object>of("access_token", "   "),
                Map.<String, Object>of("access_token", Map.of("private-marker", "secret")),
                Map.<String, Object>of("access_token", "synthetic-access", "refresh_token", " "),
                Map.<String, Object>of("access_token", "synthetic-access", "refresh_token", Map.of("private-marker", "secret")),
                Map.<String, Object>of("access_token", "synthetic-access", "error", "private-marker"),
                Map.<String, Object>of("access_token", "synthetic-access", "expires_in", 0),
                Map.<String, Object>of("access_token", "synthetic-access", "expires_in", -1),
                Map.<String, Object>of("access_token", "synthetic-access", "expires_in", 1.5),
                Map.<String, Object>of("access_token", "synthetic-access", "expires_in", 4294967297L),
                Map.<String, Object>of("access_token", "synthetic-access", "expires_in", Double.NaN),
                Map.<String, Object>of("access_token", "synthetic-access", "expires_in", "private-marker"));
        return Stream.of("airbnb", "homeaway", "minut", "netatmo")
                .flatMap(provider -> responses.stream().flatMap(body -> Stream.of(
                        Arguments.of(provider, body, false), Arguments.of(provider, body, true))));
    }

    @ParameterizedTest
    @MethodSource("invalidResponses")
    void rejectsInvalidResponseWithoutOverwritingCredentials(String provider, Map<String, Object> body, boolean refresh) {
        var http = mock(RestTemplate.class);
        var h = harness(provider, http);
        when(http.postForEntity(anyString(), any(), eq(Map.class))).thenReturn(ResponseEntity.ok(body));
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(h.logger());
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        try {
            Runnable action = refresh ? h.refresh() : h.exchange();
            if (refresh && (provider.equals("minut") || provider.equals("netatmo"))) {
                action.run();
            } else {
                assertThatThrownBy(action::run).satisfies(failure -> {
                    var text = new java.io.StringWriter();
                    failure.printStackTrace(new java.io.PrintWriter(text));
                    assertThat(text.toString()).doesNotContain("private-marker", "synthetic-access", "secret");
                });
            }
            assertThat(h.status().get()).isNotEqualTo("ACTIVE");
            assertThat(h.access().get()).isEqualTo("encrypted-access");
            assertThat(h.refreshToken().get()).isEqualTo("encrypted-refresh");
            assertThat(h.expiry().get()).isEqualTo(LocalDateTime.of(2030, 1, 1, 0, 0));
            assertThat(h.error().get()).satisfies(error -> {
                if (error != null) assertThat(error).doesNotContain("private-marker", "synthetic-access", "secret");
            });
            for (var event : appender.list) {
                assertThat(event.getFormattedMessage()).doesNotContain("private-marker", "synthetic-access", "secret");
            }
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"airbnb", "homeaway", "minut", "netatmo"})
    void validExchangeAndRefreshRetainDefaultsAndSupportRotation(String provider) {
        var http = mock(RestTemplate.class);
        var h = harness(provider, http);
        Map<String, Object> body = new HashMap<>();
        body.put("access_token", "synthetic-access");
        body.put("refresh_token", "synthetic-refresh");
        when(http.postForEntity(anyString(), any(), eq(Map.class))).thenReturn(ResponseEntity.ok(body));
        var before = LocalDateTime.now();
        h.exchange().run();
        assertThat(h.status().get()).isEqualTo("ACTIVE");
        assertThat(h.access().get()).isEqualTo("encrypted-synthetic-access");
        assertThat(h.refreshToken().get()).isEqualTo("encrypted-synthetic-refresh");
        if (provider.equals("airbnb") || provider.equals("homeaway")) {
            assertThat(h.expiry().get()).isNull();
        } else {
            int seconds = provider.equals("minut") ? 3600 : 10800;
            assertThat(h.expiry().get()).isBetween(before.plusSeconds(seconds), LocalDateTime.now().plusSeconds(seconds));
        }

        body.put("access_token", "rotated-access");
        body.remove("refresh_token");
        body.put("expires_in", 7200L);
        before = LocalDateTime.now();
        h.refresh().run();
        assertThat(h.status().get()).isEqualTo("ACTIVE");
        assertThat(h.access().get()).isEqualTo("encrypted-rotated-access");
        assertThat(h.refreshToken().get()).isEqualTo("encrypted-synthetic-refresh");
        assertThat(h.expiry().get()).isBetween(before.plusSeconds(7200), LocalDateTime.now().plusSeconds(7200));

        body.put("refresh_token", "rotated-refresh");
        h.refresh().run();
        assertThat(h.refreshToken().get()).isEqualTo("encrypted-rotated-refresh");
    }

    @org.junit.jupiter.api.Test
    void responseDiagnosticsDoNotExposeTokensOrParserCause() {
        var parsed = BaitlyOAuthTokenResponse.parse(Map.of("access_token", "private-marker"), null);
        assertThat(parsed.toString()).doesNotContain("private-marker");
        assertThatThrownBy(() -> BaitlyOAuthTokenResponse.parse(
                Map.of("access_token", "private-marker", "expires_in", Double.POSITIVE_INFINITY), null))
                .hasNoCause().hasMessage("Réponse OAuth inutilisable ; reconnexion requise");
    }
}
