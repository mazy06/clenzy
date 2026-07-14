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
        // 1200 updates a valeurs ALTERNEES (incompressibles) -> tiennent quand
        // meme dans UN SEUL appel (cap 5000 entrees ; limite reelle Channex =
        // 10 MB) : c'est ce qui garantit le full sync 500 j en 2 appels (certif).
        List<ChannexAvailabilityUpdate> updates = java.util.stream.IntStream.range(0, 1200)
            .mapToObj(i -> new ChannexAvailabilityUpdate("prop-1", "room-1",
                LocalDate.of(2026, 6, 1).plusDays(i), i % 2))
            .toList();

        mockServer.expect(requestTo(BASE + "/availability"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        client.pushAvailability(updates);
        mockServer.verify();
    }

    @Test
    @DisplayName("pushAvailability compresse les runs en date_from/date_to + parse tasks/warnings")
    void pushAvailability_compressesRunsAndParsesResponse() {
        // 10 jours a availability=1 -> 1 seule entree {date_from, date_to}
        List<ChannexAvailabilityUpdate> updates = java.util.stream.IntStream.range(0, 10)
            .mapToObj(i -> new ChannexAvailabilityUpdate("prop-1", "room-1",
                LocalDate.of(2026, 6, 1).plusDays(i), 1))
            .toList();

        mockServer.expect(requestTo(BASE + "/availability"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content()
                .string(org.hamcrest.Matchers.allOf(
                    org.hamcrest.Matchers.containsString("\"date_from\":\"2026-06-01\""),
                    org.hamcrest.Matchers.containsString("\"date_to\":\"2026-06-10\""),
                    org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("\"date\":\"2026-06-02\"")))))
            .andRespond(withSuccess(
                "{\"data\":[{\"id\":\"task-1\",\"type\":\"task\"}],\"meta\":{\"warnings\":[\"w1\"]}}",
                MediaType.APPLICATION_JSON));

        var result = client.pushAvailability(updates);
        mockServer.verify();
        assertThat(result.taskIds()).containsExactly("task-1");
        assertThat(result.warnings()).containsExactly("w1");
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

    // ─── Additional tests ──────────────────────────────────────────────────

    @Test
    @DisplayName("deleteProperty envoie DELETE /properties/{id}")
    void deleteProperty_sendsDelete() {
        mockServer.expect(requestTo(BASE + "/properties/prop-xx"))
            .andExpect(method(HttpMethod.DELETE))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        client.deleteProperty("prop-xx");
        mockServer.verify();
    }

    @Test
    @DisplayName("updatePropertyTitle envoie PUT avec nouveau titre")
    void updatePropertyTitle_sendsPut() {
        mockServer.expect(requestTo(BASE + "/properties/prop-1"))
            .andExpect(method(HttpMethod.PUT))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        client.updatePropertyTitle("prop-1", "Nouveau titre");
        mockServer.verify();
    }

    @Test
    @DisplayName("deleteChannel envoie DELETE /channels/{id}")
    void deleteChannel_sendsDelete() {
        mockServer.expect(requestTo(BASE + "/channels/ch-1"))
            .andExpect(method(HttpMethod.DELETE))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        client.deleteChannel("ch-1");
        mockServer.verify();
    }

    @Test
    @DisplayName("deactivateChannel envoie PUT avec is_active=false")
    void deactivateChannel_sendsPut() {
        mockServer.expect(requestTo(BASE + "/channels/ch-x"))
            .andExpect(method(HttpMethod.PUT))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        client.deactivateChannel("ch-x");
        mockServer.verify();
    }

    @Test
    @DisplayName("pushRates no-op si liste vide ou null")
    void pushRates_noopOnEmpty() {
        client.pushRates(java.util.List.of());
        client.pushRates(null);
        mockServer.verify();
    }

    @Test
    @DisplayName("pushRates : 750 jours a valeurs identiques -> 1 appel, 1 entree compressee")
    void pushRates_chunksBatches() {
        java.util.List<ChannexRateUpdate> updates = java.util.stream.IntStream.range(0, 750)
            .mapToObj(i -> ChannexRateUpdate.rateOnly("p", "r",
                LocalDate.of(2026, 1, 1).plusDays(i), new BigDecimal("100")))
            .toList();

        // Valeurs identiques sur 750 jours consecutifs -> compression en UNE
        // entree {date_from, date_to} -> UN SEUL appel API (full sync certif).
        mockServer.expect(requestTo(BASE + "/restrictions"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content()
                .string(org.hamcrest.Matchers.allOf(
                    org.hamcrest.Matchers.containsString("\"date_from\":\"2026-01-01\""),
                    org.hamcrest.Matchers.containsString("\"date_to\":\"2028-01-20\""))))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        client.pushRates(updates);
        mockServer.verify();
    }

    @Test
    @DisplayName("getProperty retourne le DTO sur 200")
    void getProperty_returnsDto() {
        String body = """
            {
              "data": {
                "id": "prop-yyy",
                "type": "property",
                "attributes": {
                  "title": "Loft Parisien",
                  "currency": "EUR",
                  "timezone": "Europe/Paris"
                }
              }
            }
            """;
        mockServer.expect(requestTo(BASE + "/properties/prop-yyy"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        ChannexPropertyDto result = client.getProperty("prop-yyy");
        assertThat(result.id()).isEqualTo("prop-yyy");
        assertThat(result.title()).isEqualTo("Loft Parisien");
    }

    @Test
    @DisplayName("acknowledgeBooking envoie POST /bookings/{id}/ack")
    void acknowledgeBooking_sendsPost() {
        mockServer.expect(requestTo(BASE + "/bookings/bk-1/ack"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        client.acknowledgeBooking("bk-1");
        mockServer.verify();
    }

    @Test
    @DisplayName("getBooking retourne le JsonNode")
    void getBooking_returnsNode() {
        mockServer.expect(requestTo(BASE + "/bookings/bk-1"))
            .andRespond(withSuccess("{\"data\":{\"id\":\"bk-1\"}}", MediaType.APPLICATION_JSON));

        var node = client.getBooking("bk-1");
        assertThat(node).isNotNull();
        assertThat(node.path("data").path("id").asText()).isEqualTo("bk-1");
    }

    @Test
    @DisplayName("fetchAllPropertiesRaw retourne le payload brut")
    void fetchAllProperties_returnsRaw() {
        mockServer.expect(requestTo(BASE + "/properties"))
            .andRespond(withSuccess("{\"data\":[],\"meta\":{\"total\":0}}",
                MediaType.APPLICATION_JSON));

        var raw = client.fetchAllPropertiesRaw();
        assertThat(raw).isNotNull();
        assertThat(raw.path("meta").path("total").asInt()).isZero();
    }

    @Test
    @DisplayName("fetchAllChannelsRaw retourne le payload brut")
    void fetchAllChannels_returnsRaw() {
        mockServer.expect(requestTo(BASE + "/channels"))
            .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));

        var raw = client.fetchAllChannelsRaw();
        assertThat(raw).isNotNull();
        assertThat(raw.path("data").isArray()).isTrue();
    }

    @Test
    @DisplayName("hasActiveOtaChannel retourne true si channel actif avec property liee")
    void hasActiveOtaChannel_truthy() {
        String body = """
            {
              "data": [
                {
                  "id": "ch-1",
                  "type": "channel",
                  "attributes": {
                    "is_active": true,
                    "properties": ["prop-1"]
                  }
                }
              ]
            }
            """;
        mockServer.expect(requestTo(BASE + "/channels"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThat(client.hasActiveOtaChannel("prop-1")).isTrue();
    }

    @Test
    @DisplayName("hasActiveOtaChannel retourne false si aucun channel actif")
    void hasActiveOtaChannel_falsy() {
        String body = """
            {
              "data": [
                {
                  "id": "ch-1",
                  "type": "channel",
                  "attributes": {
                    "is_active": false,
                    "properties": ["prop-1"]
                  }
                }
              ]
            }
            """;
        mockServer.expect(requestTo(BASE + "/channels"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThat(client.hasActiveOtaChannel("prop-1")).isFalse();
    }

    @Test
    @DisplayName("hasActiveOtaChannel false si response vide ou non-array data")
    void hasActiveOtaChannel_emptyResponse() {
        mockServer.expect(requestTo(BASE + "/channels"))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertThat(client.hasActiveOtaChannel("prop-1")).isFalse();
    }

    @Test
    @DisplayName("fetchPropertyGroupId retourne le group_id depuis relationships")
    void fetchPropertyGroupId_returnsGroupId() {
        String body = """
            {
              "data": {
                "id": "prop-1",
                "type": "property",
                "attributes": {"title":"t"},
                "relationships": {
                  "groups": {
                    "data": [
                      {"id":"grp-99", "type":"group"}
                    ]
                  }
                }
              }
            }
            """;
        mockServer.expect(requestTo(BASE + "/properties/prop-1"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThat(client.fetchPropertyGroupId("prop-1")).isEqualTo("grp-99");
    }

    @Test
    @DisplayName("fetchPropertyGroupId leve NOT_FOUND si pas de group")
    void fetchPropertyGroupId_throwsWhenMissing() {
        String body = """
            {
              "data": {
                "id": "prop-1",
                "attributes": {},
                "relationships": {}
              }
            }
            """;
        mockServer.expect(requestTo(BASE + "/properties/prop-1"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.fetchPropertyGroupId("prop-1"))
            .isInstanceOf(ChannexException.class)
            .satisfies(e -> assertThat(((ChannexException) e).getKind())
                .isEqualTo(ChannexException.Kind.NOT_FOUND));
    }

    @Test
    @DisplayName("updateRatePlanSettings rejette un payload vide")
    void updateRatePlanSettings_rejectsEmpty() {
        com.clenzy.integration.channex.dto.ChannexRatePlanSettingsUpdate empty =
            new com.clenzy.integration.channex.dto.ChannexRatePlanSettingsUpdate(
                null, null, null, null, null, null, null, null);
        assertThatThrownBy(() -> client.updateRatePlanSettings("rp-1", empty))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("updateRatePlanSettings rejette payload null")
    void updateRatePlanSettings_rejectsNull() {
        assertThatThrownBy(() -> client.updateRatePlanSettings("rp-1", null))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
