package com.clenzy.integration;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.clenzy.integration.minut.config.MinutConfig;
import com.clenzy.integration.minut.service.MinutApiService;
import com.clenzy.integration.minut.service.MinutOAuthService;
import com.clenzy.integration.netatmo.config.NetatmoConfig;
import com.clenzy.integration.netatmo.service.NetatmoApiService;
import com.clenzy.integration.netatmo.service.NetatmoOAuthService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Provider bodies, device paths and query strings must not escape via diagnostics. */
class BaitlyIoTApiDiagnosticsPrivacyTest {
    private static final String PRIVATE = "synthetic-private-home-device";
    private static final String TOKEN = "synthetic-private-token";
    private final RestTemplate http = mock(RestTemplate.class);

    private MinutApiService minut() {
        var config = mock(MinutConfig.class);
        when(config.getApiBaseUrl()).thenReturn("https://minut.example.invalid");
        var oauth = mock(MinutOAuthService.class);
        when(oauth.getValidAccessToken(PRIVATE)).thenReturn(TOKEN);
        return new MinutApiService(config, oauth, http);
    }

    private NetatmoApiService netatmo() {
        var config = mock(NetatmoConfig.class);
        when(config.getApiBaseUrl()).thenReturn("https://netatmo.example.invalid");
        var oauth = mock(NetatmoOAuthService.class);
        when(oauth.getValidAccessToken(PRIVATE)).thenReturn(TOKEN);
        return new NetatmoApiService(config, oauth, http);
    }

    private RuntimeException failure(boolean timeout) {
        RuntimeException error = timeout
                ? new ResourceAccessException("GET https://example.invalid/" + PRIVATE,
                    new IOException(TOKEN + " guest@example.invalid"))
                : HttpClientErrorException.create(HttpStatus.UNAUTHORIZED, PRIVATE,
                    new HttpHeaders(), (TOKEN + " guest@example.invalid").getBytes(StandardCharsets.UTF_8),
                    StandardCharsets.UTF_8);
        error.addSuppressed(new RuntimeException(PRIVATE));
        return error;
    }

    @ParameterizedTest
    @ValueSource(strings = {"get", "post", "put", "timeout"})
    void minutReadAndWriteFailuresArePrivateAndNeverRetried(String action) {
        var service = minut();
        failHttp(failure(action.equals("timeout")));
        assertPrivateFailure(MinutApiService.class, "Minut", () -> switch (action) {
            case "post" -> service.createWebhook(PRIVATE, "https://example.invalid/" + PRIVATE, List.of(PRIVATE));
            case "put" -> service.updateDisturbanceConfig(PRIVATE, PRIVATE, Map.of("recipient", PRIVATE));
            default -> service.getSoundLevels(PRIVATE, PRIVATE, PRIVATE, PRIVATE, 1800);
        });
        assertThat(mockingDetails(http).getInvocations()).hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"get", "post", "timeout"})
    void netatmoFailuresHideQueryParametersAndProviderBodies(String action) {
        var service = netatmo();
        failHttp(failure(action.equals("timeout")));
        assertPrivateFailure(NetatmoApiService.class, "Netatmo", () -> {
            if (action.equals("post")) {
                service.setThermpoint(PRIVATE, PRIVATE, PRIVATE, 19.5);
                return null;
            }
            return service.getHomeStatus(PRIVATE, PRIVATE);
        });
        assertThat(mockingDetails(http).getInvocations()).hasSize(1);
    }

    @SuppressWarnings("unchecked")
    private void failHttp(RuntimeException failure) {
        when(http.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class),
                any(ParameterizedTypeReference.class))).thenThrow(failure);
    }

    private void assertPrivateFailure(Class<?> type, String provider, Supplier<?> operation) {
        var logger = (Logger) LoggerFactory.getLogger(type);
        var logs = new ListAppender<ILoggingEvent>();
        logs.start();
        logger.addAppender(logs);
        try {
            assertThatThrownBy(operation::get).hasMessage("Erreur appel API " + provider).hasNoCause()
                    .satisfies(error -> assertThat(error.getSuppressed()).isEmpty());
            assertThat(logs.list).hasSize(1).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain(PRIVATE, TOKEN, "example.invalid", "19.5");
                assertThat(event.getThrowableProxy()).isNull();
                assertThat(event.getArgumentArray()).isNull();
            });
        } finally {
            logger.detachAppender(logs);
            logs.stop();
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void netatmoFailedReadIsNotCachedAsSuccessAndNextExplicitReadCanRecover() {
        var service = netatmo();
        Map<String, Object> readings = Map.of("body", Map.of("devices", List.of()));
        when(http.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                .thenThrow(failure(true)).thenReturn(ResponseEntity.ok(readings));
        assertPrivateFailure(NetatmoApiService.class, "Netatmo", () -> service.getStationsData(PRIVATE));
        assertThat(mockingDetails(http).getInvocations()).hasSize(1);
        assertThat(service.getStationsData(PRIVATE)).isEqualTo(readings);
        assertThat(service.getStationsData(PRIVATE)).isEqualTo(readings);
        assertThat(mockingDetails(http).getInvocations()).hasSize(2);
    }

    @Test
    @SuppressWarnings("unchecked")
    void successfulReadsAndCommandsPreservePayloadAndBearerAuthentication() {
        var minut = minut();
        var netatmo = netatmo();
        Map<String, Object> result = Map.of("status", "ok");
        when(http.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(result));
        assertThat(minut.getDevice(PRIVATE, PRIVATE)).isEqualTo(result);
        assertThat(minut.createWebhook(PRIVATE, "https://example.invalid", List.of("test"))).isEqualTo(result);
        assertThat(minut.updateDisturbanceConfig(PRIVATE, PRIVATE, Map.of("enabled", true))).isEqualTo(result);
        assertThat(netatmo.getHomeStatus(PRIVATE, PRIVATE)).isEqualTo(result);
        netatmo.setThermpoint(PRIVATE, PRIVATE, PRIVATE, 19.5);
        verify(http, times(5)).exchange(anyString(), any(HttpMethod.class),
                argThat((HttpEntity<?> entity) -> ("Bearer " + TOKEN).equals(entity.getHeaders().getFirst("Authorization"))),
                any(ParameterizedTypeReference.class));
    }
}
