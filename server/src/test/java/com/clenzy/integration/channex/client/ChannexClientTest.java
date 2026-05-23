package com.clenzy.integration.channex.client;

import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.config.ChannexProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import com.clenzy.integration.channex.dto.ChannexAvailabilityUpdate;
import com.clenzy.integration.channex.dto.ChannexCreatePropertyRequest;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.dto.ChannexRateUpdate;
import com.clenzy.integration.channex.exception.ChannexException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Tests unitaires pour {@link ChannexClient} via {@link MockRestServiceServer}.
 *
 * <p>Couvre :</p>
 * <ul>
 *   <li>Auth Bearer token + headers (User-Agent, Content-Type)</li>
 *   <li>Creation property (POST /properties)</li>
 *   <li>Push availability + rates (POST /availability, /restrictions) avec chunking</li>
 *   <li>Mapping d'erreurs HTTP -> ChannexException.Kind</li>
 *   <li>Retry logic sur erreurs retryables (429, 5xx)</li>
 *   <li>Garde-fou : pas d'appel si API key non configuree</li>
 * </ul>
 */
@DisplayName("ChannexClient")
class ChannexClientTest {

    private static final String BASE = "https://staging.channex.io/api/v1";

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private ChannexProperties props;
    private ChannexClient client;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        props = new ChannexProperties();
        props.setBaseUrl(BASE);
        props.setApiKey("test-api-key-secret");
        props.setMaxRetries(3);
        client = new ChannexClient(restTemplate, props, new ChannexMetrics(new SimpleMeterRegistry()));
    }

    // ─── createProperty ─────────────────────────────────────────────────────

    @Test
    @DisplayName("createProperty envoie POST /properties avec Bearer auth + body JSON")
    void createProperty_sendsBearerAuthAndBody() {
        String responseBody = """
            { "id": "prop-123", "title": "Studio Marais", "currency": "EUR",
              "group_id": null, "timezone": "Europe/Paris" }
            """;

        mockServer.expect(requestTo(BASE + "/properties"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-api-key-secret"))
            .andExpect(header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE))
            .andExpect(header("User-Agent", "Clenzy-PMS/1.0 (channex-client)"))
            .andRespond(withSuccess(responseBody, MediaType.APPLICATION_JSON));

        ChannexCreatePropertyRequest req = new ChannexCreatePropertyRequest(
            "Studio Marais", "EUR", "FR", "Europe/Paris", null
        );

        ChannexPropertyDto result = client.createProperty(req);

        assertThat(result.id()).isEqualTo("prop-123");
        assertThat(result.title()).isEqualTo("Studio Marais");
        assertThat(result.currency()).isEqualTo("EUR");
        mockServer.verify();
    }

    @Test
    @DisplayName("createProperty echoue avec UNAUTHORIZED si API key vide")
    void createProperty_throwsIfNoApiKey() {
        props.setApiKey("");
        ChannexCreatePropertyRequest req = new ChannexCreatePropertyRequest(
            "Studio", "EUR", "FR", "Europe/Paris", null
        );

        assertThatThrownBy(() -> client.createProperty(req))
            .isInstanceOf(ChannexException.class)
            .satisfies(e -> assertThat(((ChannexException) e).getKind())
                .isEqualTo(ChannexException.Kind.UNAUTHORIZED));
    }

    // ─── pushAvailability ───────────────────────────────────────────────────

    @Test
    @DisplayName("pushAvailability split en chunks de 500 et envoie tous les chunks")
    void pushAvailability_chunksBatches() {
        // 1200 updates -> 3 chunks (500 + 500 + 200)
        List<ChannexAvailabilityUpdate> updates = java.util.stream.IntStream.range(0, 1200)
            .mapToObj(i -> new ChannexAvailabilityUpdate("prop-1", "room-1",
                LocalDate.of(2026, 6, 1).plusDays(i), i % 2))
            .toList();

        for (int i = 0; i < 3; i++) {
            mockServer.expect(requestTo(BASE + "/availability"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        }

        client.pushAvailability(updates);
        mockServer.verify();
    }

    @Test
    @DisplayName("pushAvailability no-op si liste vide")
    void pushAvailability_noopOnEmpty() {
        client.pushAvailability(List.of());
        client.pushAvailability(null);
        mockServer.verify(); // aucun appel attendu
    }

    // ─── pushRates ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("pushRates envoie les restrictions au bon endpoint")
    void pushRates_sendsToRestrictions() {
        mockServer.expect(requestTo(BASE + "/restrictions"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        client.pushRates(List.of(
            ChannexRateUpdate.rateOnly("prop-1", "rate-1", LocalDate.of(2026, 6, 1), new BigDecimal("89.00"))
        ));
        mockServer.verify();
    }

    // ─── Error mapping ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("HTTP error mapping")
    class ErrorMapping {

        @Test
        @DisplayName("401 -> UNAUTHORIZED (non retryable)")
        void mapsUnauthorized() {
            mockServer.expect(requestTo(BASE + "/properties/abc"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED).body("{\"error\":\"invalid token\"}"));

            assertThatThrownBy(() -> client.getProperty("abc"))
                .isInstanceOf(ChannexException.class)
                .satisfies(e -> {
                    ChannexException ex = (ChannexException) e;
                    assertThat(ex.getKind()).isEqualTo(ChannexException.Kind.UNAUTHORIZED);
                    assertThat(ex.isRetryable()).isFalse();
                });
        }

        @Test
        @DisplayName("404 -> NOT_FOUND (non retryable)")
        void mapsNotFound() {
            mockServer.expect(requestTo(BASE + "/properties/zzz"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND).body("{\"error\":\"not found\"}"));

            assertThatThrownBy(() -> client.getProperty("zzz"))
                .isInstanceOf(ChannexException.class)
                .satisfies(e -> {
                    ChannexException ex = (ChannexException) e;
                    assertThat(ex.getKind()).isEqualTo(ChannexException.Kind.NOT_FOUND);
                    assertThat(ex.isRetryable()).isFalse();
                });
        }

        @Test
        @DisplayName("400 -> BAD_REQUEST (non retryable)")
        void mapsBadRequest() {
            mockServer.expect(requestTo(BASE + "/properties"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).body("{\"error\":\"missing field\"}"));

            ChannexCreatePropertyRequest req = new ChannexCreatePropertyRequest(
                "X", "EUR", "FR", "Europe/Paris", null
            );

            assertThatThrownBy(() -> client.createProperty(req))
                .isInstanceOf(ChannexException.class)
                .satisfies(e -> {
                    ChannexException ex = (ChannexException) e;
                    assertThat(ex.getKind()).isEqualTo(ChannexException.Kind.BAD_REQUEST);
                    assertThat(ex.isRetryable()).isFalse();
                });
        }

        @Test
        @DisplayName("429 + 429 + success retourne le success apres retries")
        void retriesOnRateLimit() {
            String successBody = """
                { "id": "prop-retry", "title": "T", "currency": "EUR" }
                """;

            mockServer.expect(requestTo(BASE + "/properties/prop-retry"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
            mockServer.expect(requestTo(BASE + "/properties/prop-retry"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
            mockServer.expect(requestTo(BASE + "/properties/prop-retry"))
                .andRespond(withSuccess(successBody, MediaType.APPLICATION_JSON));

            ChannexPropertyDto result = client.getProperty("prop-retry");
            assertThat(result.id()).isEqualTo("prop-retry");
            mockServer.verify();
        }

        @Test
        @DisplayName("500 persistant epuise les retries et leve SERVER_ERROR")
        void exhaustsRetriesOn5xx() {
            for (int i = 0; i < 3; i++) {
                mockServer.expect(requestTo(BASE + "/properties/prop-down"))
                    .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
            }

            assertThatThrownBy(() -> client.getProperty("prop-down"))
                .isInstanceOf(ChannexException.class)
                .satisfies(e -> {
                    ChannexException ex = (ChannexException) e;
                    assertThat(ex.getKind()).isEqualTo(ChannexException.Kind.SERVER_ERROR);
                    assertThat(ex.isRetryable()).isTrue();
                });
            mockServer.verify();
        }
    }
}
