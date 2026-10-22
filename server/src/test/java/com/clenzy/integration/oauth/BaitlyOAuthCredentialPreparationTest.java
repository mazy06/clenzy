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

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.client.RestTemplate;
import java.util.Optional;
import java.util.function.Supplier;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.Map;

import java.util.stream.Stream;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.springframework.http.ResponseEntity;

/** Vérifie la conservation du couple de secrets en cas de chiffrement partiellement réussi. */
class BaitlyOAuthCredentialPreparationTest {
    record Harness(Class<?> logger, Runnable exchange, Runnable refresh, Supplier<LocalDateTime> expiry,
            Supplier<String> error, Supplier<String> access, Supplier<String> refreshToken, Supplier<String> status) {}

    Harness harness(String provider, RestTemplate http, String failingToken) {
        var redis = mock(StringRedisTemplate.class);
        var audit = mock(AuditLogService.class);
        var tenant = mock(TenantContext.class);
        if (provider.equals("airbnb")) {
            var config = mock(AirbnbConfig.class);
            when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
            when(config.getApiBaseUrl()).thenReturn("https://oauth.example.invalid");
            var repo = mock(AirbnbConnectionRepository.class);
            var crypto = mock(AirbnbTokenEncryptionService.class);
            when(crypto.encrypt(anyString())).thenAnswer(call -> {
                String token = call.getArgument(0);
                if (token.equals(failingToken)) throw new IllegalStateException("Synthetic encryption failure");
                return "encrypted-" + token;
            });
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
            when(crypto.encrypt(anyString())).thenAnswer(call -> {
                String token = call.getArgument(0);
                if (token.equals(failingToken)) throw new IllegalStateException("Synthetic encryption failure");
                return "encrypted-" + token;
            });
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
        when(crypto.encrypt(anyString())).thenAnswer(call -> {
                String token = call.getArgument(0);
                if (token.equals(failingToken)) throw new IllegalStateException("Synthetic encryption failure");
                return "encrypted-" + token;
            });
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


    static Stream<Arguments> failures() {
        return Stream.of("airbnb", "homeaway", "minut", "netatmo")
                .flatMap(provider -> Stream.of("synthetic-access", "synthetic-refresh")
                        .flatMap(token -> Stream.of(Arguments.of(provider, token, false), Arguments.of(provider, token, true))));
    }

    @ParameterizedTest
    @MethodSource("failures")
    void encryptionFailurePreservesBothCredentialsAndExpiry(String provider, String token, boolean refresh) {
        var http = mock(RestTemplate.class);
        var h = harness(provider, http, token);
        when(http.postForEntity(anyString(), any(), eq(Map.class))).thenReturn(ResponseEntity.ok(
                Map.of("access_token", "synthetic-access", "refresh_token", "synthetic-refresh", "expires_in", 3600)));
        Runnable action = refresh ? h.refresh() : h.exchange();
        if (refresh && (provider.equals("minut") || provider.equals("netatmo"))) {
            action.run();
        } else {
            assertThatThrownBy(action::run).isInstanceOf(RuntimeException.class);
        }
        assertThat(h.access().get()).isEqualTo("encrypted-access");
        assertThat(h.refreshToken().get()).isEqualTo("encrypted-refresh");
        assertThat(h.expiry().get()).isEqualTo(LocalDateTime.of(2030, 1, 1, 0, 0));
        assertThat(h.status().get()).isNotEqualTo("ACTIVE");
        verify(http, times(1)).postForEntity(anyString(), any(), eq(Map.class));
    }
}
