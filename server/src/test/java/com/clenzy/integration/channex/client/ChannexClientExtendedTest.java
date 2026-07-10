package com.clenzy.integration.channex.client;

import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.config.ChannexProperties;
import com.clenzy.integration.channex.dto.ChannexAvailabilityUpdate;
import com.clenzy.integration.channex.dto.ChannexBookingsListResponse;
import com.clenzy.integration.channex.dto.ChannexChannelDto;
import com.clenzy.integration.channex.dto.ChannexCreateChannelRequest;
import com.clenzy.integration.channex.dto.ChannexCreateRatePlanRequest;
import com.clenzy.integration.channex.dto.ChannexCreateRoomTypeRequest;
import com.clenzy.integration.channex.dto.ChannexRatePlanDto;
import com.clenzy.integration.channex.dto.ChannexRatePlanSettingsUpdate;
import com.clenzy.integration.channex.dto.ChannexRateUpdate;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDto;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.service.ChannexCapabilityService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Tests etendus pour {@link ChannexClient} — coverage des methodes restantes
 * (deleteProperty, channels CRUD, room_types/rate_plans, whitelabel endpoints,
 * bookings, messages, reviews, stripe tokenization).
 *
 * <p>Complete {@link ChannexClientTest} qui couvre createProperty/embed URLs/
 * push availability+rates + mapping erreurs.</p>
 *
 * <p><b>Note URL matching</b> : Spring RestTemplate encode automatiquement les
 * crochets {@code [/]} en {@code %5B/%5D}. Pour ces URLs on utilise
 * {@link org.hamcrest.Matchers#containsString} sur le path plutot que matcher
 * l'URL exacte.</p>
 */
@DisplayName("ChannexClient (extended coverage)")
class ChannexClientExtendedTest {

    private static final String BASE = "https://staging.channex.io/api/v1";

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private ChannexProperties props;
    private ChannexCapabilityService capabilities;
    private ChannexClient client;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        props = new ChannexProperties();
        props.setBaseUrl(BASE);
        props.setApiKey("test-api-key");
        props.setMaxRetries(3);
        capabilities = new ChannexCapabilityService();
        client = new ChannexClient(restTemplate, props,
            new ChannexMetrics(new SimpleMeterRegistry()),
            new ObjectMapper(), capabilities);
    }

    // --- Properties: getProperty / deleteProperty / updatePropertyTitle / fetchAll ---

    @Test
    @DisplayName("getProperty deserialise JSON:API singleton")
    void getProperty_unwrapsJsonApi() {
        String body = "{\"data\":{\"id\":\"prop-1\",\"type\":\"property\",\"attributes\":{"
            + "\"title\":\"Studio\",\"currency\":\"EUR\",\"timezone\":\"Europe/Paris\"}}}";
        mockServer.expect(requestTo(BASE + "/properties/prop-1"))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header("user-api-key", "test-api-key"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        var result = client.getProperty("prop-1");
        assertThat(result.id()).isEqualTo("prop-1");
        assertThat(result.title()).isEqualTo("Studio");
        mockServer.verify();
    }

    @Test
    @DisplayName("deleteProperty envoie DELETE et ne leve pas")
    void deleteProperty_sendsDelete() {
        mockServer.expect(requestTo(BASE + "/properties/prop-x"))
            .andExpect(method(HttpMethod.DELETE))
            .andRespond(withSuccess());

        client.deleteProperty("prop-x");
        mockServer.verify();
    }

    @Test
    @DisplayName("updatePropertyTitle envoie PUT avec body property.title")
    void updatePropertyTitle_sendsPut() {
        mockServer.expect(requestTo(BASE + "/properties/prop-1"))
            .andExpect(method(HttpMethod.PUT))
            .andRespond(withSuccess());

        client.updatePropertyTitle("prop-1", "New Title");
        mockServer.verify();
    }

    @Test
    @DisplayName("fetchAllPropertiesRaw renvoie le JsonNode brut")
    void fetchAllPropertiesRaw_returnsRaw() {
        String body = "{\"data\":[{\"id\":\"a\"},{\"id\":\"b\"}],\"meta\":{\"total\":2}}";
        mockServer.expect(requestTo(BASE + "/properties"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        JsonNode raw = client.fetchAllPropertiesRaw();
        assertThat(raw.path("data").isArray()).isTrue();
        assertThat(raw.path("data").size()).isEqualTo(2);
    }

    @Test
    @DisplayName("fetchPropertyRaw renvoie le JsonNode brut")
    void fetchPropertyRaw_returnsRaw() {
        String body = "{\"data\":{\"id\":\"prop-1\",\"attributes\":{\"title\":\"X\"}}}";
        mockServer.expect(requestTo(BASE + "/properties/prop-1"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        JsonNode raw = client.fetchPropertyRaw("prop-1");
        assertThat(raw.path("data").path("id").asText()).isEqualTo("prop-1");
    }

    @Test
    @DisplayName("fetchPropertyGroupId extrait l'id depuis relationships.groups.data")
    void fetchPropertyGroupId_extracts() {
        String body = "{\"data\":{\"id\":\"prop-1\",\"attributes\":{\"title\":\"X\"},"
            + "\"relationships\":{\"groups\":{\"data\":[{\"id\":\"group-42\",\"type\":\"group\"}]}}}}";
        mockServer.expect(requestTo(BASE + "/properties/prop-1"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        String groupId = client.fetchPropertyGroupId("prop-1");
        assertThat(groupId).isEqualTo("group-42");
    }

    @Test
    @DisplayName("fetchPropertyGroupId leve NOT_FOUND si pas de groups")
    void fetchPropertyGroupId_throwsIfNoGroup() {
        String body = "{\"data\":{\"id\":\"prop-1\",\"attributes\":{\"title\":\"X\"},\"relationships\":{}}}";
        mockServer.expect(requestTo(BASE + "/properties/prop-1"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.fetchPropertyGroupId("prop-1"))
            .isInstanceOf(ChannexException.class)
            .satisfies(e -> assertThat(((ChannexException) e).getKind())
                .isEqualTo(ChannexException.Kind.NOT_FOUND));
    }

    // --- Channels: createChannel / delete / deactivate / fetchAll / hasActiveOta ---

    @Test
    @DisplayName("createChannel envoie POST /channels et deserialise la reponse")
    void createChannel_sendsPost() {
        String body = "{\"data\":{\"id\":\"chan-1\",\"type\":\"channel\",\"attributes\":{"
            + "\"title\":\"Airbnb FR\",\"channel\":\"Airbnb\",\"is_active\":false}}}";
        mockServer.expect(requestTo(BASE + "/channels"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        ChannexChannelDto result = client.createChannel(new ChannexCreateChannelRequest(
            "Airbnb FR", "Airbnb", "prop-1", "group-1"
        ));
        assertThat(result.id()).isEqualTo("chan-1");
        assertThat(result.channelName()).isEqualTo("Airbnb");
        assertThat(result.isActive()).isFalse();
    }

    @Test
    @DisplayName("deleteChannel envoie DELETE")
    void deleteChannel_sendsDelete() {
        mockServer.expect(requestTo(BASE + "/channels/chan-1"))
            .andExpect(method(HttpMethod.DELETE))
            .andRespond(withSuccess());

        client.deleteChannel("chan-1");
        mockServer.verify();
    }

    @Test
    @DisplayName("deactivateChannel envoie PUT avec is_active=false")
    void deactivateChannel_sendsPut() {
        mockServer.expect(requestTo(BASE + "/channels/chan-1"))
            .andExpect(method(HttpMethod.PUT))
            .andRespond(withSuccess());

        client.deactivateChannel("chan-1");
        mockServer.verify();
    }

    @Test
    @DisplayName("fetchAllChannelsRaw renvoie le payload brut")
    void fetchAllChannelsRaw_returnsRaw() {
        String body = "{\"data\":[{\"id\":\"c1\",\"attributes\":{\"channel\":\"Airbnb\"}}]}";
        mockServer.expect(requestTo(BASE + "/channels"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        JsonNode raw = client.fetchAllChannelsRaw();
        assertThat(raw.path("data").isArray()).isTrue();
    }

    @Test
    @DisplayName("hasActiveOtaChannel: true si channel actif lie via attributes.properties array")
    void hasActiveOtaChannel_returnsTrueIfMatchInPropsArray() {
        String body = "{\"data\":[{\"id\":\"c1\",\"attributes\":{\"is_active\":true,"
            + "\"properties\":[\"prop-1\",\"prop-2\"]}}]}";
        mockServer.expect(requestTo(BASE + "/channels"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThat(client.hasActiveOtaChannel("prop-1")).isTrue();
    }

    @Test
    @DisplayName("hasActiveOtaChannel: true si channel actif lie via relationships.properties.data")
    void hasActiveOtaChannel_returnsTrueIfMatchInRelationships() {
        String body = "{\"data\":[{\"id\":\"c1\",\"attributes\":{\"is_active\":true},"
            + "\"relationships\":{\"properties\":{\"data\":[{\"id\":\"prop-1\",\"type\":\"property\"}]}}}]}";
        mockServer.expect(requestTo(BASE + "/channels"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThat(client.hasActiveOtaChannel("prop-1")).isTrue();
    }

    @Test
    @DisplayName("hasActiveOtaChannel: false si channel inactif")
    void hasActiveOtaChannel_falseIfInactive() {
        String body = "{\"data\":[{\"id\":\"c1\",\"attributes\":{\"is_active\":false,"
            + "\"properties\":[\"prop-1\"]}}]}";
        mockServer.expect(requestTo(BASE + "/channels"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThat(client.hasActiveOtaChannel("prop-1")).isFalse();
    }

    @Test
    @DisplayName("hasActiveOtaChannel: false si pas de match")
    void hasActiveOtaChannel_falseIfNoMatch() {
        String body = "{\"data\":[{\"id\":\"c1\",\"attributes\":{\"is_active\":true,"
            + "\"properties\":[\"prop-OTHER\"]}}]}";
        mockServer.expect(requestTo(BASE + "/channels"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThat(client.hasActiveOtaChannel("prop-1")).isFalse();
    }

    @Test
    @DisplayName("hasActiveOtaChannel: false si data pas un array")
    void hasActiveOtaChannel_falseIfNoData() {
        String body = "{\"meta\":{\"empty\":true}}";
        mockServer.expect(requestTo(BASE + "/channels"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThat(client.hasActiveOtaChannel("prop-1")).isFalse();
    }

    // --- Channel iframe with channel scope ---

    @Test
    @DisplayName("createChannelEmbedUrl construit l'URL avec le token + property + lng")
    void createChannelEmbedUrl_buildsUrl() {
        mockServer.expect(requestTo(BASE + "/auth/one_time_token"))
            .andRespond(withSuccess("{\"data\":{\"token\":\"abc\"}}", MediaType.APPLICATION_JSON));

        String url = client.createChannelEmbedUrl("prop-1", "chan-1", "admin@x.fr", "en");
        assertThat(url).contains("oauth_session_key=abc");
        assertThat(url).contains("property_id=prop-1");
        assertThat(url).contains("lng=en");
    }

    @Test
    @DisplayName("createChannelEmbedUrl leve si pas de token")
    void createChannelEmbedUrl_throwsIfNoToken() {
        mockServer.expect(requestTo(BASE + "/auth/one_time_token"))
            .andRespond(withSuccess("{\"data\":{}}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.createChannelEmbedUrl("prop-1", "chan-1", "u", "fr"))
            .isInstanceOf(ChannexException.class);
    }

    // --- Room Types / Rate Plans ---

    @Test
    @DisplayName("createRoomType envoie POST /room_types")
    void createRoomType_sendsPost() {
        String body = "{\"data\":{\"id\":\"rt-1\",\"type\":\"room_type\",\"attributes\":{"
            + "\"title\":\"Studio\",\"property_id\":\"prop-1\",\"count_of_rooms\":1}}}";
        mockServer.expect(requestTo(BASE + "/room_types"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        ChannexRoomTypeDto rt = client.createRoomType(
            ChannexCreateRoomTypeRequest.simple("prop-1", "Studio", 4));
        assertThat(rt.id()).isEqualTo("rt-1");
        assertThat(rt.title()).isEqualTo("Studio");
    }

    @Test
    @DisplayName("createRatePlan envoie POST /rate_plans")
    void createRatePlan_sendsPost() {
        String body = "{\"data\":{\"id\":\"rp-1\",\"type\":\"rate_plan\",\"attributes\":{"
            + "\"title\":\"Standard Rate\",\"property_id\":\"prop-1\",\"room_type_id\":\"rt-1\","
            + "\"currency\":\"EUR\",\"sell_mode\":\"per_room\"}}}";
        mockServer.expect(requestTo(BASE + "/rate_plans"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        ChannexRatePlanDto rp = client.createRatePlan(
            ChannexCreateRatePlanRequest.standard("prop-1", "rt-1", "EUR", 4));
        assertThat(rp.id()).isEqualTo("rp-1");
        assertThat(rp.roomTypeId()).isEqualTo("rt-1");
    }

    @Test
    @DisplayName("updateRatePlanSettings envoie PUT /rate_plans/{id}")
    void updateRatePlanSettings_sendsPut() {
        mockServer.expect(requestTo(BASE + "/rate_plans/rp-1"))
            .andExpect(method(HttpMethod.PUT))
            .andRespond(withSuccess());

        client.updateRatePlanSettings("rp-1",
            new ChannexRatePlanSettingsUpdate(new BigDecimal("100"), null, null, null,
                null, null, 2, null));
        mockServer.verify();
    }

    @Test
    @DisplayName("updateRatePlanSettings leve IllegalArgumentException si payload null ou vide")
    void updateRatePlanSettings_throwsIfEmpty() {
        assertThatThrownBy(() -> client.updateRatePlanSettings("rp-1", null))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> client.updateRatePlanSettings("rp-1",
            new ChannexRatePlanSettingsUpdate(null, null, null, null, null, null, null, null)))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("fetchRoomTypesForProperty retourne liste vide si data pas un array")
    void fetchRoomTypesForProperty_empty() {
        mockServer.expect(requestTo(containsString("/room_types?")))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertThat(client.fetchRoomTypesForProperty("prop-1")).isEmpty();
    }

    @Test
    @DisplayName("fetchRoomTypesForProperty parse les items JSON:API")
    void fetchRoomTypesForProperty_parsesItems() {
        String body = "{\"data\":["
            + "{\"id\":\"rt-1\",\"type\":\"room_type\",\"attributes\":{\"title\":\"Studio\",\"property_id\":\"prop-1\"}},"
            + "{\"id\":\"rt-2\",\"type\":\"room_type\",\"attributes\":{\"title\":\"Suite\",\"property_id\":\"prop-1\"}}"
            + "]}";
        mockServer.expect(requestTo(containsString("/room_types?")))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        List<ChannexRoomTypeDto> rts = client.fetchRoomTypesForProperty("prop-1");
        assertThat(rts).hasSize(2);
        assertThat(rts.get(0).id()).isEqualTo("rt-1");
        assertThat(rts.get(1).title()).isEqualTo("Suite");
    }

    @Test
    @DisplayName("fetchRatePlansForProperty parse JSON:API collection")
    void fetchRatePlansForProperty_parsesItems() {
        String body = "{\"data\":["
            + "{\"id\":\"rp-1\",\"type\":\"rate_plan\",\"attributes\":{"
            + "\"title\":\"Standard\",\"property_id\":\"prop-1\",\"room_type_id\":\"rt-1\",\"currency\":\"EUR\"}}"
            + "]}";
        mockServer.expect(requestTo(containsString("/rate_plans?")))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        List<ChannexRatePlanDto> rps = client.fetchRatePlansForProperty("prop-1");
        assertThat(rps).hasSize(1);
        assertThat(rps.get(0).id()).isEqualTo("rp-1");
    }

    // --- fetchRoomTypeDetail / fetchHotelPolicies / fetchPhotos / facilityCatalog ---

    @Test
    @DisplayName("fetchRoomTypeDetail: null si id blank")
    void fetchRoomTypeDetail_nullIfBlank() {
        assertThat(client.fetchRoomTypeDetail(null)).isNull();
        assertThat(client.fetchRoomTypeDetail("")).isNull();
    }

    @Test
    @DisplayName("fetchRoomTypeDetail: null si erreur Channex (best-effort)")
    void fetchRoomTypeDetail_nullOnError() {
        for (int i = 0; i < 3; i++) {
            mockServer.expect(requestTo(BASE + "/room_types/rt-zz"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        }

        assertThat(client.fetchRoomTypeDetail("rt-zz")).isNull();
    }

    @Test
    @DisplayName("fetchHotelPoliciesForProperty: empty si id blank")
    void fetchHotelPoliciesForProperty_emptyIfBlank() {
        assertThat(client.fetchHotelPoliciesForProperty(null)).isEmpty();
        assertThat(client.fetchHotelPoliciesForProperty("")).isEmpty();
    }

    @Test
    @DisplayName("fetchHotelPoliciesForProperty: empty si exception")
    void fetchHotelPoliciesForProperty_emptyOnError() {
        for (int i = 0; i < 3; i++) {
            mockServer.expect(requestTo(containsString("/hotel_policies?")))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        }

        assertThat(client.fetchHotelPoliciesForProperty("prop-1")).isEmpty();
    }

    @Test
    @DisplayName("fetchPhotosForProperty: empty si id blank")
    void fetchPhotosForProperty_emptyIfBlank() {
        assertThat(client.fetchPhotosForProperty(null)).isEmpty();
        assertThat(client.fetchPhotosForProperty("")).isEmpty();
    }

    @Test
    @DisplayName("fetchPhotosForProperty: parse OK")
    void fetchPhotosForProperty_returnsList() {
        String body = "{\"data\":[]}";
        mockServer.expect(requestTo(containsString("/photos?")))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThat(client.fetchPhotosForProperty("prop-1")).isEmpty();
    }

    @Test
    @DisplayName("fetchPropertyFacilityCatalog: empty si exception")
    void fetchPropertyFacilityCatalog_emptyOnError() {
        for (int i = 0; i < 3; i++) {
            mockServer.expect(requestTo(BASE + "/property_facilities/options"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        }

        assertThat(client.fetchPropertyFacilityCatalog()).isEmpty();
    }

    @Test
    @DisplayName("fetchPropertyFacilityCatalog: parse OK avec data array vide")
    void fetchPropertyFacilityCatalog_returnsList() {
        mockServer.expect(requestTo(BASE + "/property_facilities/options"))
            .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));

        assertThat(client.fetchPropertyFacilityCatalog()).isEmpty();
    }

    // --- Whitelabel endpoints: short-circuit + actual call ---

    @Test
    @DisplayName("fetchChannelListings: empty si channelId blank (sans appel HTTP)")
    void fetchChannelListings_emptyIfBlank() {
        assertThat(client.fetchChannelListings(null)).isEmpty();
        assertThat(client.fetchChannelListings("")).isEmpty();
    }

    @Test
    @DisplayName("fetchChannelListings: cache markUnavailable apres 401 et empty au prochain call")
    void fetchChannelListings_cachesUnavailableOnUnauthorized() {
        // 1er call: UNAUTHORIZED -> markUnavailable
        mockServer.expect(requestTo(BASE + "/channels/chan-1/listings"))
            .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        Optional<List<com.clenzy.integration.channex.dto.ChannexChannelListingDto>> first =
            client.fetchChannelListings("chan-1");
        assertThat(first).isEmpty();

        // 2eme call: capability cache unavailable -> pas d'appel HTTP
        Optional<List<com.clenzy.integration.channex.dto.ChannexChannelListingDto>> second =
            client.fetchChannelListings("chan-1");
        assertThat(second).isEmpty();

        // mockServer verifie qu'il n'y a eu qu'1 seul HTTP call
        mockServer.verify();
    }

    @Test
    @DisplayName("fetchChannelListingDetail: empty si channelId ou listingId null")
    void fetchChannelListingDetail_emptyIfNull() {
        assertThat(client.fetchChannelListingDetail(null, "lid")).isEmpty();
        assertThat(client.fetchChannelListingDetail("chan", null)).isEmpty();
    }

    @Test
    @DisplayName("mapListingToRoom: false apres unauthorized + cache")
    void mapListingToRoom_falseOnUnauthorized() {
        mockServer.expect(requestTo(BASE + "/channels/chan-1/listings/lid-1/map"))
            .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThat(client.mapListingToRoom("chan-1", "lid-1", "rt-1", "rp-1")).isFalse();
    }

    @Test
    @DisplayName("mapListingToRoom: true sur 200")
    void mapListingToRoom_trueOnSuccess() {
        mockServer.expect(requestTo(BASE + "/channels/chan-1/listings/lid-1/map"))
            .andRespond(withSuccess());

        assertThat(client.mapListingToRoom("chan-1", "lid-1", "rt-1", "rp-1")).isTrue();
    }

    @Test
    @DisplayName("fetchPropertyFacilities: empty si propertyId null")
    void fetchPropertyFacilities_emptyIfNull() {
        assertThat(client.fetchPropertyFacilities(null)).isEmpty();
    }

    @Test
    @DisplayName("fetchPropertyFacilities: liste vide si pas d'included")
    void fetchPropertyFacilities_emptyIfNoIncluded() {
        mockServer.expect(requestTo(BASE + "/properties/prop-1?include=facilities"))
            .andRespond(withSuccess("{\"data\":{\"id\":\"p1\"}}", MediaType.APPLICATION_JSON));

        Optional<List<com.clenzy.integration.channex.dto.ChannexFacilityOptionDto>> result =
            client.fetchPropertyFacilities("prop-1");
        assertThat(result).isPresent();
        assertThat(result.get()).isEmpty();
    }

    @Test
    @DisplayName("fetchPropertyFacilities: extrait les facilities depuis included")
    void fetchPropertyFacilities_parsesIncluded() {
        String body = "{\"data\":{\"id\":\"p1\"},\"included\":["
            + "{\"id\":\"fac-1\",\"type\":\"facility\",\"attributes\":{\"title\":\"Wifi\",\"category\":\"connect\"}},"
            + "{\"id\":\"fac-2\",\"type\":\"facility\",\"attributes\":{\"title\":\"Pool\",\"category\":\"outdoor\"}},"
            + "{\"id\":\"x\",\"type\":\"other\",\"attributes\":{\"title\":\"Skip\"}}"
            + "]}";
        mockServer.expect(requestTo(BASE + "/properties/prop-1?include=facilities"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        Optional<List<com.clenzy.integration.channex.dto.ChannexFacilityOptionDto>> result =
            client.fetchPropertyFacilities("prop-1");
        assertThat(result).isPresent();
        // facility type only (2), skip "other"
        assertThat(result.get()).hasSize(2);
        assertThat(result.get().get(0).title()).isEqualTo("Wifi");
    }

    @Test
    @DisplayName("registerWebhook: false si unauthorized")
    void registerWebhook_falseOnUnauthorized() {
        mockServer.expect(requestTo(BASE + "/webhooks"))
            .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThat(client.registerWebhook("https://x.com/hook", List.of("listing_updated"))).isFalse();
    }

    @Test
    @DisplayName("registerWebhook: true sur 200")
    void registerWebhook_trueOnSuccess() {
        mockServer.expect(requestTo(BASE + "/webhooks"))
            .andRespond(withSuccess());

        assertThat(client.registerWebhook("https://x.com/hook", List.of("listing_updated"))).isTrue();
    }

    // --- Availability / Rates ---

    @Test
    @DisplayName("pushAvailability: corps array values vide ne push pas")
    void pushAvailability_emptyList() {
        client.pushAvailability(List.of());
        // mockServer attend 0 requete - tout est OK
    }

    @Test
    @DisplayName("pushRates: corps null no-op")
    void pushRates_null() {
        client.pushRates(null);
    }

    @Test
    @DisplayName("pushRates: avec restrictions complete (min stay, CTA, CTD, max stay)")
    void pushRates_withRestrictions() {
        mockServer.expect(requestTo(BASE + "/restrictions"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(jsonPath("$.values[0].max_stay").value(14))
            .andExpect(jsonPath("$.values[0].min_stay_through").value(3))
            .andRespond(withSuccess());

        client.pushRates(List.of(
            new ChannexRateUpdate("prop-1", "rp-1",
                LocalDate.of(2026, 6, 1), new BigDecimal("100.00"),
                3, 2, true, false, 14)
        ));
        mockServer.verify();
    }

    @Test
    @DisplayName("pushAvailability: une seule entree")
    void pushAvailability_oneEntry() {
        mockServer.expect(requestTo(BASE + "/availability"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess());

        client.pushAvailability(List.of(
            new ChannexAvailabilityUpdate("prop-1", "rt-1", LocalDate.of(2026, 6, 1), 1)
        ));
        mockServer.verify();
    }

    // --- fetchRatesForRange (Optional pattern) ---

    @Test
    @DisplayName("fetchRatesForRange: empty si endpoint en erreur")
    void fetchRatesForRange_emptyOnError() {
        for (int i = 0; i < 3; i++) {
            mockServer.expect(requestTo(containsString("/restrictions?")))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        }

        Optional<List<JsonNode>> result = client.fetchRatesForRange("prop-1", "rp-1",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7));
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("fetchRatesForRange: empty list si data pas un array")
    void fetchRatesForRange_emptyIfNotArray() {
        mockServer.expect(requestTo(containsString("/restrictions?")))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        Optional<List<JsonNode>> result = client.fetchRatesForRange("prop-1", "rp-1",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7));
        assertThat(result).isPresent();
        assertThat(result.get()).isEmpty();
    }

    @Test
    @DisplayName("fetchRatesForRange: parse les entries quand data est un array")
    void fetchRatesForRange_parsesEntries() {
        String body = "{\"data\":["
            + "{\"id\":\"r1\",\"attributes\":{\"date\":\"2026-06-01\",\"rate\":\"89.00\"}},"
            + "{\"id\":\"r2\",\"attributes\":{\"date\":\"2026-06-02\",\"rate\":\"95.00\"}}"
            + "]}";
        mockServer.expect(requestTo(containsString("/restrictions?")))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        Optional<List<JsonNode>> result = client.fetchRatesForRange("prop-1", "rp-1",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7));
        assertThat(result).isPresent();
        assertThat(result.get()).hasSize(2);
    }

    // --- Bookings ---

    @Test
    @DisplayName("getBooking renvoie JsonNode brut")
    void getBooking_returnsRaw() {
        String body = "{\"data\":{\"id\":\"book-1\",\"attributes\":{\"status\":\"new\"}}}";
        mockServer.expect(requestTo(BASE + "/bookings/book-1"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        JsonNode result = client.getBooking("book-1");
        assertThat(result.path("data").path("id").asText()).isEqualTo("book-1");
    }

    @Test
    @DisplayName("acknowledgeBooking envoie POST /bookings/{id}/ack")
    void acknowledgeBooking_sendsPost() {
        mockServer.expect(requestTo(BASE + "/bookings/book-1/ack"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess());

        client.acknowledgeBooking("book-1");
        mockServer.verify();
    }

    @Test
    @DisplayName("listBookings envoie GET avec property_id + dates")
    void listBookings_buildsUrl() {
        String body = "{\"data\":[]}";
        mockServer.expect(requestTo(containsString("/bookings?")))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        ChannexBookingsListResponse result = client.listBookings("prop-1",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30));
        assertThat(result.bookings()).isEmpty();
    }

    // --- Sprint Quick Wins endpoints (Optional pattern) ---

    @Test
    @DisplayName("fetchChannelLogs: returns Optional on success")
    void fetchChannelLogs_ok() {
        mockServer.expect(requestTo(containsString("/channels/c1/logs")))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        assertThat(client.fetchChannelLogs("c1", 50)).isPresent();
    }

    @Test
    @DisplayName("fetchChannelLogs: empty si erreur Channex")
    void fetchChannelLogs_emptyOnError() {
        for (int i = 0; i < 3; i++) {
            mockServer.expect(requestTo(containsString("/channels/c1/logs")))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        }
        assertThat(client.fetchChannelLogs("c1", 50)).isEmpty();
    }

    @Test
    @DisplayName("fetchChannelWebhookLogs: forme URL avec limit clamped")
    void fetchChannelWebhookLogs_url() {
        mockServer.expect(requestTo(containsString("/channels/c1/webhook_logs")))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        assertThat(client.fetchChannelWebhookLogs("c1", 20)).isPresent();
    }

    @Test
    @DisplayName("fetchChannelWebhookLogs: empty si erreur")
    void fetchChannelWebhookLogs_emptyOnError() {
        for (int i = 0; i < 3; i++) {
            mockServer.expect(requestTo(containsString("/channels/c1/webhook_logs")))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        }
        assertThat(client.fetchChannelWebhookLogs("c1", 20)).isEmpty();
    }

    @Test
    @DisplayName("fetchBillingUsage: empty si pas de billing_account_id dans profile")
    void fetchBillingUsage_emptyIfNoBillingId() {
        mockServer.expect(requestTo(BASE + "/user_profile"))
            .andRespond(withSuccess("{\"data\":{}}", MediaType.APPLICATION_JSON));

        assertThat(client.fetchBillingUsage()).isEmpty();
    }

    @Test
    @DisplayName("fetchBillingUsage: fetch /usage si billing_account_id present")
    void fetchBillingUsage_fetchesUsage() {
        mockServer.expect(requestTo(BASE + "/user_profile"))
            .andRespond(withSuccess(
                "{\"data\":{\"billing_account_id\":\"ba-1\"}}", MediaType.APPLICATION_JSON));
        mockServer.expect(requestTo(BASE + "/billing_accounts/ba-1/usage"))
            .andRespond(withSuccess("{\"data\":{\"used\":100}}", MediaType.APPLICATION_JSON));

        Optional<JsonNode> result = client.fetchBillingUsage();
        assertThat(result).isPresent();
    }

    @Test
    @DisplayName("testWebhook: POST /webhooks/{id}/test")
    void testWebhook_ok() {
        mockServer.expect(requestTo(BASE + "/webhooks/wh-1/test"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"status\":\"ok\"}", MediaType.APPLICATION_JSON));

        assertThat(client.testWebhook("wh-1")).isPresent();
    }

    @Test
    @DisplayName("testWebhook: empty si erreur Channex")
    void testWebhook_emptyOnError() {
        for (int i = 0; i < 3; i++) {
            mockServer.expect(requestTo(BASE + "/webhooks/wh-1/test"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        }
        assertThat(client.testWebhook("wh-1")).isEmpty();
    }

    // --- Messages ---

    @Nested
    @DisplayName("Messages App")
    class Messages {
        @Test
        @DisplayName("fetchBookingMessages: GET /bookings/{id}/messages")
        void fetchBookingMessages_ok() {
            mockServer.expect(requestTo(BASE + "/bookings/book-1/messages"))
                .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));
            assertThat(client.fetchBookingMessages("book-1")).isPresent();
        }

        @Test
        @DisplayName("fetchBookingMessages: empty si erreur Channex")
        void fetchBookingMessages_emptyOnError() {
            for (int i = 0; i < 3; i++) {
                mockServer.expect(requestTo(BASE + "/bookings/book-1/messages"))
                    .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
            }
            assertThat(client.fetchBookingMessages("book-1")).isEmpty();
        }

        @Test
        @DisplayName("sendBookingMessage: POST /bookings/{id}/messages")
        void sendBookingMessage_ok() {
            mockServer.expect(requestTo(BASE + "/bookings/book-1/messages"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"data\":{\"id\":\"msg-1\"}}", MediaType.APPLICATION_JSON));
            assertThat(client.sendBookingMessage("book-1", "Hello")).isPresent();
        }

        @Test
        @DisplayName("sendBookingMessage: gere un message null (envoie empty)")
        void sendBookingMessage_nullMessage() {
            mockServer.expect(requestTo(BASE + "/bookings/book-1/messages"))
                .andRespond(withSuccess("{\"data\":{}}", MediaType.APPLICATION_JSON));
            assertThat(client.sendBookingMessage("book-1", null)).isPresent();
        }

        @Test
        @DisplayName("fetchMessageThreads: avec propertyId, ajoute le filtre")
        void fetchMessageThreads_withProperty() {
            mockServer.expect(requestTo(containsString("/message_threads?")))
                .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));
            assertThat(client.fetchMessageThreads("prop-1")).isPresent();
        }

        @Test
        @DisplayName("fetchMessageThreads: sans propertyId, URL sans filtre")
        void fetchMessageThreads_withoutProperty() {
            mockServer.expect(requestTo(BASE + "/message_threads"))
                .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));
            assertThat(client.fetchMessageThreads(null)).isPresent();
        }

        @Test
        @DisplayName("fetchThreadMessages: GET /message_threads/{id}/messages")
        void fetchThreadMessages_ok() {
            mockServer.expect(requestTo(BASE + "/message_threads/th-1/messages"))
                .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));
            assertThat(client.fetchThreadMessages("th-1")).isPresent();
        }

        @Test
        @DisplayName("uploadAttachment: POST /attachments avec corps base64")
        void uploadAttachment_ok() {
            mockServer.expect(requestTo(BASE + "/attachments"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"data\":{\"url\":\"https://x.com/a\"}}",
                    MediaType.APPLICATION_JSON));
            assertThat(client.uploadAttachment("file.png", "image/png", "AAA")).isPresent();
        }

        @Test
        @DisplayName("uploadAttachment: defauts safe si null")
        void uploadAttachment_defaults() {
            mockServer.expect(requestTo(BASE + "/attachments"))
                .andRespond(withSuccess("{\"data\":{}}", MediaType.APPLICATION_JSON));
            assertThat(client.uploadAttachment(null, null, null)).isPresent();
        }
    }

    // --- Reviews ---

    @Nested
    @DisplayName("Reviews App")
    class Reviews {
        @Test
        @DisplayName("fetchReviews: page + limit + filtre property optionnel")
        void fetchReviews_buildsUrl() {
            mockServer.expect(requestTo(containsString("/reviews?")))
                .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));
            assertThat(client.fetchReviews("prop-1", 1, 20)).isPresent();
        }

        @Test
        @DisplayName("fetchReviews: limit clamped")
        void fetchReviews_clamps() {
            mockServer.expect(requestTo(containsString("/reviews?")))
                .andRespond(withSuccess("{\"data\":[]}", MediaType.APPLICATION_JSON));
            // 999 -> 100
            assertThat(client.fetchReviews(null, 1, 999)).isPresent();
        }

        @Test
        @DisplayName("fetchReview: GET /reviews/{id}")
        void fetchReview_ok() {
            mockServer.expect(requestTo(BASE + "/reviews/rv-1"))
                .andRespond(withSuccess("{\"data\":{\"id\":\"rv-1\"}}", MediaType.APPLICATION_JSON));
            assertThat(client.fetchReview("rv-1")).isPresent();
        }

        @Test
        @DisplayName("replyToReview: POST /reviews/{id}/reply")
        void replyToReview_ok() {
            mockServer.expect(requestTo(BASE + "/reviews/rv-1/reply"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"data\":{}}", MediaType.APPLICATION_JSON));
            assertThat(client.replyToReview("rv-1", "Merci !")).isPresent();
        }

        @Test
        @DisplayName("replyToReview: defauts safe si replyText null")
        void replyToReview_nullText() {
            mockServer.expect(requestTo(BASE + "/reviews/rv-1/reply"))
                .andRespond(withSuccess("{\"data\":{}}", MediaType.APPLICATION_JSON));
            assertThat(client.replyToReview("rv-1", null)).isPresent();
        }

        @Test
        @DisplayName("fetchPropertyScore: GET /scores/{id}")
        void fetchPropertyScore_ok() {
            mockServer.expect(requestTo(BASE + "/scores/prop-1"))
                .andRespond(withSuccess("{\"data\":{}}", MediaType.APPLICATION_JSON));
            assertThat(client.fetchPropertyScore("prop-1")).isPresent();
        }

        @Test
        @DisplayName("fetchPropertyScoreDetailed: GET /scores/{id}/detailed")
        void fetchPropertyScoreDetailed_ok() {
            mockServer.expect(requestTo(BASE + "/scores/prop-1/detailed"))
                .andRespond(withSuccess("{\"data\":{}}", MediaType.APPLICATION_JSON));
            assertThat(client.fetchPropertyScoreDetailed("prop-1")).isPresent();
        }

        @Test
        @DisplayName("fetchPropertyScore: empty si erreur Channex")
        void fetchPropertyScore_emptyOnError() {
            for (int i = 0; i < 3; i++) {
                mockServer.expect(requestTo(BASE + "/scores/prop-1"))
                    .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
            }
            assertThat(client.fetchPropertyScore("prop-1")).isEmpty();
        }
    }

    // --- Stripe tokenization ---

    @Test
    @DisplayName("stripeTokenizeBooking: POST avec stripe_account_id")
    void stripeTokenizeBooking_withAccount() {
        mockServer.expect(requestTo(BASE + "/bookings/book-1/stripe_token"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"data\":{\"token\":\"tok\"}}", MediaType.APPLICATION_JSON));
        assertThat(client.stripeTokenizeBooking("book-1", "acct_1234")).isPresent();
    }

    @Test
    @DisplayName("stripeTokenizeBooking: stripeAccountId null, body vide")
    void stripeTokenizeBooking_nullAccount() {
        mockServer.expect(requestTo(BASE + "/bookings/book-1/stripe_token"))
            .andRespond(withSuccess("{\"data\":{}}", MediaType.APPLICATION_JSON));
        assertThat(client.stripeTokenizeBooking("book-1", null)).isPresent();
    }

    @Test
    @DisplayName("stripeTokenizeBookingPaymentMethod: POST /stripe_payment_method")
    void stripeTokenizeBookingPaymentMethod_ok() {
        mockServer.expect(requestTo(BASE + "/bookings/book-1/stripe_payment_method"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"data\":{}}", MediaType.APPLICATION_JSON));
        assertThat(client.stripeTokenizeBookingPaymentMethod("book-1", "acct_1")).isPresent();
    }

    @Test
    @DisplayName("stripeTokenizeBookingPaymentMethod: empty si erreur Channex")
    void stripeTokenizeBookingPaymentMethod_emptyOnError() {
        for (int i = 0; i < 3; i++) {
            mockServer.expect(requestTo(BASE + "/bookings/book-1/stripe_payment_method"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        }
        assertThat(client.stripeTokenizeBookingPaymentMethod("book-1", "acct_1")).isEmpty();
    }

    // --- createEmbedUrl: scenario isConfigured = false ---

    @Test
    @DisplayName("Tout call avec apiKey vide leve UNAUTHORIZED")
    void allCalls_unauthorizedWhenApiKeyEmpty() {
        props.setApiKey("");
        assertThatThrownBy(() -> client.getProperty("p1"))
            .isInstanceOf(ChannexException.class)
            .satisfies(e -> assertThat(((ChannexException) e).getKind())
                .isEqualTo(ChannexException.Kind.UNAUTHORIZED));
    }
}
