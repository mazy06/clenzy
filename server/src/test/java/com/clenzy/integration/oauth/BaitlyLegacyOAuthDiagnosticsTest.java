package com.clenzy.integration.oauth;

import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.integration.airbnb.service.*;
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
import com.clenzy.integration.netatmo.service.*;
import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.client.RestTemplate;
import java.util.Optional;
import java.util.function.Supplier;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Contrôle les vrais chemins de service avec HTTP, chiffrement et stockage simulés. */
class BaitlyLegacyOAuthDiagnosticsTest {
    record Harness(Class<?> logger, Runnable exchange, Runnable refresh, Runnable revoke,
            Supplier<String> error, Supplier<String> access, Supplier<String> refreshToken, Supplier<String> status) {}

    Harness harness(String provider,RestTemplate http) { return harness(provider,http,false); }

    Harness harness(String provider,RestTemplate http,boolean decryptFailure) {
        var redis=mock(StringRedisTemplate.class);var audit=mock(AuditLogService.class);var tenant=mock(TenantContext.class);
        if(provider.equals("airbnb")) {
            var config=mock(AirbnbConfig.class);when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
            when(config.getApiBaseUrl()).thenReturn("https://oauth.example.invalid");
            var repo=mock(AirbnbConnectionRepository.class);var crypto=mock(AirbnbTokenEncryptionService.class);
            when(crypto.decrypt(anyString())).thenAnswer(call -> {if(decryptFailure)throw privateFailure();return "synthetic-token";});
            var c=new AirbnbConnection();c.setId(1L);c.setUserId("user-test");c.setAccessTokenEncrypted("encrypted-access");c.setRefreshTokenEncrypted("encrypted-refresh");
            c.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            when(repo.findByUserId("user-test")).thenReturn(Optional.of(c));when(repo.save(any())).thenAnswer(call->call.getArgument(0));
            var service=new AirbnbOAuthService(config,repo,crypto,audit,redis,http);
            return new Harness(service.getClass(),()->service.exchangeCodeForToken("synthetic-code","user-test"),()->service.refreshToken("user-test"),
                    ()->service.revokeToken("user-test"),c::getErrorMessage,c::getAccessTokenEncrypted,c::getRefreshTokenEncrypted,()->c.getStatus().name());
        }
        if(provider.equals("homeaway")) {
            var config=mock(HomeAwayConfig.class);when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
            var repo=mock(HomeAwayConnectionRepository.class);var crypto=mock(AirbnbTokenEncryptionService.class);
            when(crypto.decrypt(anyString())).thenAnswer(call -> {if(decryptFailure)throw privateFailure();return "synthetic-token";});
            var c=new HomeAwayConnection();c.setId(1L);c.setOrganizationId(7L);c.setAccessTokenEncrypted("encrypted-access");c.setRefreshTokenEncrypted("encrypted-refresh");
            c.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            when(repo.findByOrganizationId(7L)).thenReturn(Optional.of(c));when(repo.save(any())).thenAnswer(call->call.getArgument(0));
            var service=new HomeAwayOAuthService(config,repo,crypto,audit,redis,http);
            return new Harness(service.getClass(),()->service.exchangeCodeForToken("synthetic-code",7L),()->service.refreshToken(7L),
                    ()->{},c::getErrorMessage,c::getAccessTokenEncrypted,c::getRefreshTokenEncrypted,()->c.getStatus().name());
        }
        var crypto=mock(TokenEncryptionService.class);when(crypto.decrypt(anyString())).thenAnswer(call -> {if(decryptFailure)throw privateFailure();return "synthetic-token";});
        if(provider.equals("minut")) {
            var config=mock(MinutConfig.class);when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");when(config.getApiBaseUrl()).thenReturn("https://oauth.example.invalid");
            var repo=mock(MinutConnectionRepository.class);var c=new MinutConnection();c.setUserId("user-test");c.setOrganizationId(7L);
            c.setAccessTokenEncrypted("encrypted-access");c.setRefreshTokenEncrypted("encrypted-refresh");c.setStatus(MinutConnection.MinutConnectionStatus.ACTIVE);
            when(repo.findByUserId("user-test")).thenReturn(Optional.of(c));when(repo.save(any())).thenAnswer(call->call.getArgument(0));
            var service=new MinutOAuthService(config,repo,crypto,tenant,redis,http);
            return new Harness(service.getClass(),()->service.exchangeCodeForToken("synthetic-code","user-test"),()->service.refreshToken(c),()->service.revokeToken("user-test"),
                    c::getErrorMessage,c::getAccessTokenEncrypted,c::getRefreshTokenEncrypted,()->c.getStatus().name());
        }
        var config=mock(NetatmoConfig.class);when(config.getTokenUrl()).thenReturn("https://oauth.example.invalid/token");
        var repo=mock(NetatmoConnectionRepository.class);var c=new NetatmoConnection();c.setUserId("user-test");c.setOrganizationId(7L);
        c.setAccessTokenEncrypted("encrypted-access");c.setRefreshTokenEncrypted("encrypted-refresh");c.setStatus(NetatmoConnection.NetatmoConnectionStatus.ACTIVE);
        when(repo.findByUserId("user-test")).thenReturn(Optional.of(c));when(repo.save(any())).thenAnswer(call->call.getArgument(0));
        var service=new NetatmoOAuthService(config,mock(NetatmoPlatformConfigService.class),repo,crypto,tenant,redis,http);
        return new Harness(service.getClass(),()->service.exchangeCodeForToken("synthetic-code","user-test",7L),()->service.refreshToken(c),()->service.revokeToken("user-test"),
                c::getErrorMessage,c::getAccessTokenEncrypted,c::getRefreshTokenEncrypted,()->c.getStatus().name());
    }

    RuntimeException privateFailure() {
        var failure=new IllegalStateException("access_token=private-provider",new RuntimeException("password=private-cause"));
        failure.addSuppressed(new RuntimeException("email=private-suppressed@example.invalid"));return failure;
    }
    void assertPrivate(Throwable failure) {
        var rendered=new java.io.StringWriter();failure.printStackTrace(new java.io.PrintWriter(rendered));
        assertThat(rendered.toString()).doesNotContain("private-","example.invalid","synthetic-token","synthetic-code");
        assertThat(failure).hasNoCause();assertThat(failure.getSuppressed()).isEmpty();
    }

    @ParameterizedTest @ValueSource(strings={"airbnb","homeaway","minut","netatmo"})
    void exchangeAndRefreshNeverExposeProviderDiagnostics(String provider) {
        var http=mock(RestTemplate.class);var h=harness(provider,http);
        when(http.postForEntity(anyString(),any(),eq(java.util.Map.class))).thenThrow(privateFailure());
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(h.logger());
        var appender=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();appender.start();logger.addAppender(appender);
        try {
            assertThatThrownBy(h.exchange()::run).satisfies(this::assertPrivate);
            if(provider.equals("minut")||provider.equals("netatmo"))h.refresh().run();
            else assertThatThrownBy(h.refresh()::run).satisfies(this::assertPrivate);
            assertThat(h.error().get()).isEqualTo(BaitlyOAuthDiagnostics.message(BaitlyOAuthDiagnostics.Operation.REFRESH));
            assertThat(h.status().get()).isIn("ERROR","EXPIRED");
            var layout=new ch.qos.logback.classic.PatternLayout();layout.setContext(logger.getLoggerContext());layout.setPattern("%msg %ex");layout.start();
            assertThat(appender.list).isNotEmpty();for(var event:appender.list)assertThat(layout.doLayout(event)).doesNotContain("private-","example.invalid");layout.stop();
        }finally{logger.detachAppender(appender);appender.stop();}
    }

    @ParameterizedTest @ValueSource(strings={"airbnb","minut","netatmo"})
    void failedOrUnavailableRemoteRevokeClearsBothLocalTokensWithoutClaimingConfirmation(String provider) {
        var http=mock(RestTemplate.class);var h=harness(provider,http);
        when(http.postForEntity(anyString(),any(),eq(Void.class))).thenThrow(privateFailure());
        var logger=(ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(h.logger());
        var appender=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();appender.start();logger.addAppender(appender);
        try {
            h.revoke().run();
            var layout=new ch.qos.logback.classic.PatternLayout();layout.setContext(logger.getLoggerContext());layout.setPattern("%msg %ex");layout.start();
            for(var event:appender.list)assertThat(layout.doLayout(event)).doesNotContain("private-","example.invalid");layout.stop();
        }finally{logger.detachAppender(appender);appender.stop();}
        assertThat(h.status().get()).isEqualTo("REVOKED");assertThat(h.access().get()).isNull();assertThat(h.refreshToken().get()).isNull();
        assertThat(h.error().get()).isEqualTo(BaitlyOAuthDiagnostics.message(BaitlyOAuthDiagnostics.Operation.REVOKE));
        if(provider.equals("netatmo"))verifyNoInteractions(http);
    }

    @ParameterizedTest @ValueSource(strings={"airbnb","minut"})
    void successfulRemoteRevokeClearsOldErrorAndLocalTokens(String provider) {
        var http=mock(RestTemplate.class);var h=harness(provider,http);
        when(http.postForEntity(anyString(),any(),eq(Void.class))).thenReturn(org.springframework.http.ResponseEntity.noContent().build());
        h.revoke().run();assertThat(h.error().get()).isNull();assertThat(h.access().get()).isNull();assertThat(h.refreshToken().get()).isNull();
    }

    @ParameterizedTest @ValueSource(strings={"airbnb","homeaway","minut","netatmo"})
    void decryptionFailurePreventsHttpRefreshAndStoresOnlyBoundedDiagnostics(String provider) {
        var http=mock(RestTemplate.class);var h=harness(provider,http,true);
        if(provider.equals("minut")||provider.equals("netatmo"))h.refresh().run();
        else assertThatThrownBy(h.refresh()::run).satisfies(this::assertPrivate);
        assertThat(h.error().get()).isEqualTo(BaitlyOAuthDiagnostics.message(BaitlyOAuthDiagnostics.Operation.REFRESH));
        assertThat(h.status().get()).isIn("ERROR","EXPIRED");verifyNoInteractions(http);
    }
}
