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
 *   <li>Auth user-api-key header + autres headers (User-Agent, Content-Type)</li>
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
        client = new ChannexClient(restTemplate, props, new ChannexMetrics(new SimpleMeterRegistry()),
            new com.fasterxml.jackson.databind.ObjectMapper(),
            new com.clenzy.integration.channex.service.ChannexCapabilityService());
    }

    // ─── createProperty ─────────────────────────────────────────────────────

    @Test
    @DisplayName("createProperty envoie POST /properties avec user-api-key + body JSON")
    void createProperty_sendsApiKeyHeaderAndBody() {
        // Channex renvoie au format JSON:API : data.id + data.attributes.{...}
        String responseBody = """
            {
              "data": {
                "id": "prop-123",
                "type": "property",
                "attributes": {
                  "title": "Studio Marais",
                  "currency": "EUR",
                  "group_id": null,
                  "timezone": "Europe/Paris"
                }
              }
            }
            """;

        mockServer.expect(requestTo(BASE + "/properties"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("user-api-key", "test-api-key-secret"))
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

    // ─── createEmbedUrl (Channel iframe) ────────────────────────────────────

    @Test
    @DisplayName("createEmbedUrl POST /auth/one_time_token puis construit l'URL iframe")
    void createEmbedUrl_buildsIframeUrl() {
        String tokenResponse = """
            {
              "data": { "token": "abc-123-token" },
              "meta": { "message": "OK" }
            }
            """;

        mockServer.expect(requestTo(BASE + "/auth/one_time_token"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("user-api-key", "test-api-key-secret"))
            .andRespond(withSuccess(tokenResponse, MediaType.APPLICATION_JSON));

        String url = client.createEmbedUrl("prop-uuid-1", "admin@clenzy.fr", "fr");

        // L'URL est sur le domaine sans suffixe /api/v1
        assertThat(url).startsWith("https://staging.channex.io/auth/exchange");
        // Token integre depuis data.token
        assertThat(url).contains("oauth_session_key=abc-123-token");
        // Property ID propage
        assertThat(url).contains("property_id=prop-uuid-1");
        // Mode headless + redirect vers /channels par defaut
        assertThat(url).contains("app_mode=headless");
        assertThat(url).contains("redirect_to=/channels");
        // Langue propagee
        assertThat(url).contains("lng=fr");
        mockServer.verify();
    }

    @Test
    @DisplayName("createEmbedUrl utilise 'fr' par defaut si langue null/blank")
    void createEmbedUrl_defaultsToFrenchLang() {
        mockServer.expect(requestTo(BASE + "/auth/one_time_token"))
            .andRespond(withSuccess(
                "{\"data\":{\"token\":\"tok\"}}", MediaType.APPLICATION_JSON));

        String url = client.createEmbedUrl("prop-1", "admin@clenzy.fr", null);

        assertThat(url).contains("lng=fr");
        mockServer.verify();
    }

    @Test
    @DisplayName("createEmbedUrl leve une ChannexException si Channex ne renvoie pas de token")
    void createEmbedUrl_throwsIfNoToken() {
        // Reponse sans champ data.token
        mockServer.expect(requestTo(BASE + "/auth/one_time_token"))
            .andRespond(withSuccess("{\"meta\":{\"message\":\"oups\"}}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.createEmbedUrl("prop-1", "admin@clenzy.fr", "fr"))
            .isInstanceOf(ChannexException.class)
            .satisfies(e -> assertThat(((ChannexException) e).getKind())
                .isEqualTo(ChannexException.Kind.SERVER_ERROR));
    }

    @Test
    @DisplayName("createEmbedUrl supporte une base URL sans /api/v1 (origine deja propre)")
    void createEmbedUrl_handlesBareBaseUrl() {
        props.setBaseUrl("https://app.channex.io");  // pas de /api/v1
        mockServer = MockRestServiceServer.createServer(restTemplate);

        mockServer.expect(requestTo("https://app.channex.io/auth/one_time_token"))
            .andRespond(withSuccess(
                "{\"data\":{\"token\":\"t\"}}", MediaType.APPLICATION_JSON));

        String url = client.createEmbedUrl("prop-1", "admin@clenzy.fr", "fr");

        assertThat(url).startsWith("https://app.channex.io/auth/exchange");
        mockServer.verify();
    }

    @Test
    @DisplayName("createEmbedUrl(channelCode='ABB') ajoute available_channels=ABB pour pre-filtrer le wizard")
    void createEmbedUrl_appendsAvailableChannelsFilter() {
        mockServer.expect(requestTo(BASE + "/auth/one_time_token"))
            .andRespond(withSuccess(
                "{\"data\":{\"token\":\"tok\"}}", MediaType.APPLICATION_JSON));

        String url = client.createEmbedUrl("prop-1", "admin@clenzy.fr", "fr", "ABB");

        assertThat(url).contains("available_channels=ABB");
        mockServer.verify();
    }

    @Test
    @DisplayName("createEmbedUrl(channelCode=null) n'ajoute PAS available_channels (tous OTAs visibles)")
    void createEmbedUrl_omitsFilterWhenNull() {
        mockServer.expect(requestTo(BASE + "/auth/one_time_token"))
            .andRespond(withSuccess(
                "{\"data\":{\"token\":\"tok\"}}", MediaType.APPLICATION_JSON));

        String url = client.createEmbedUrl("prop-1", "admin@clenzy.fr", "fr", null);

        assertThat(url).doesNotContain("available_channels");
        mockServer.verify();
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
