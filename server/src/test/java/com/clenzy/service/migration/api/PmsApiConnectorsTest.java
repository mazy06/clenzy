package com.clenzy.service.migration.api;

import com.clenzy.service.migration.ImportDocument;
import com.clenzy.service.migration.ImportPlan;
import com.clenzy.service.migration.PmsImportSchema;
import com.clenzy.service.migration.PmsVendorProfiles;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.*;

class PmsApiConnectorsTest {
    private final ObjectMapper json = new ObjectMapper();
    private final List<PmsApiTransport.Request> sent = new ArrayList<>();
    private final List<Long> sleeps = new ArrayList<>();
    private static final LocalDate FROM = LocalDate.of(2026, 1, 1);
    private static final LocalDate TO = LocalDate.of(2027, 1, 1);

    private PmsApiConnectors connectors(Map<String, Deque<PmsApiTransport.Response>> routes) {
        var transport = new PmsApiTransport(json, request -> {
            sent.add(request);
            String key = request.method() + " " + request.uri().getHost() + request.uri().getPath();
            var queue = routes.get(key);
            if (queue == null || queue.isEmpty()) throw new AssertionError("Unexpected call " + key);
            return queue.size() == 1 ? queue.peek() : queue.poll();
        }, sleeps::add);
        return new PmsApiConnectors(transport, json);
    }

    private static Deque<PmsApiTransport.Response> ok(String... bodies) {
        Deque<PmsApiTransport.Response> queue = new ArrayDeque<>();
        for (String body : bodies) queue.add(new PmsApiTransport.Response(200, body.getBytes(StandardCharsets.UTF_8), null));
        return queue;
    }

    @Test void hostawayPullProducesCanonicalDocumentsThatMapWithoutGuessing() {
        var routes = new HashMap<String, Deque<PmsApiTransport.Response>>();
        routes.put("POST api.hostaway.com/v1/accessTokens", ok("{\"access_token\":\"t0k\"}"));
        routes.put("GET api.hostaway.com/v1/listings", ok("""
            {"status":"success","count":1,"result":[{"id":55,"name":"Riad Nour","address":"Derb 1","city":"Marrakech",
             "countryCode":"MA","bedroomsNumber":2,"bathroomsNumber":1,"timeZoneName":"Africa/Casablanca","currencyCode":"MAD"}]}"""));
        routes.put("GET api.hostaway.com/v1/reservations", ok("""
            {"status":"success","count":2,"result":[
             {"id":991,"listingMapId":55,"guestName":"Salma Alaoui","guestEmail":"salma@example.com","arrivalDate":"2026-10-10",
              "departureDate":"2026-10-12","totalPrice":1200.5,"currency":"MAD","status":"new","channelName":"airbnbOfficial",
              "channelReservationId":"HM123","isPaid":1,"cleaningFee":150},
             {"id":992,"listingMapId":55,"guestName":"Karim","arrivalDate":"2026-11-10","departureDate":"2026-11-12",
              "totalPrice":0,"currency":"MAD","status":"inquiry"}]}"""));
        var pull = connectors(routes).pull("hostaway", Map.of("accountId", "123", "apiKey", "secret"), FROM, TO);

        assertThat(sent.getFirst().body()).contains("grant_type=client_credentials", "client_id=123");
        assertThat(sent.get(1).headers()).containsEntry("Authorization", "Bearer t0k");
        var byName = new HashMap<String, ImportDocument>();
        pull.documents().forEach(d -> byName.put(d.name(), d));
        var reservations = byName.get("Réservations (hostaway API)");
        assertThat(reservations.rows()).hasSize(2);
        assertThat(reservations.rows().getFirst()).containsEntry("propertyRef", "55").containsEntry("totalPrice", "1200.5")
            .containsEntry("amountPaid", "1200.5").containsEntry("confirmationCode", "HM123").containsEntry("guestRef", "email:salma@example.com");
        assertThat(byName.get("Voyageurs (hostaway API)").rows()).hasSize(1);
        assertThat(byName.get("Logements (hostaway API)").rows().getFirst()).containsEntry("timezone", "Africa/Casablanca");
        assertThat(pull.documents().getLast().attachmentBase64()).isNotNull();

        var plan = PmsImportSchema.suggest(reservations, PmsVendorProfiles.forSource("hostaway"));
        assertThat(plan.kind()).isEqualTo(ImportPlan.Kind.RESERVATION);
        assertThat(PmsImportSchema.map(reservations.rows().get(1), plan)).containsEntry("status", PmsImportSchema.SKIPPED_STATUS);
        assertThat(PmsImportSchema.map(reservations.rows().getFirst(), plan)).containsEntry("checkIn", "2026-10-10");
    }

    @Test void rateLimitIsRetriedWithRetryAfterThenAuthFailureIsAControlledCode() {
        var routes = new HashMap<String, Deque<PmsApiTransport.Response>>();
        Deque<PmsApiTransport.Response> apartments = new ArrayDeque<>();
        apartments.add(new PmsApiTransport.Response(429, new byte[0], "2"));
        apartments.add(new PmsApiTransport.Response(401, "{\"detail\":\"bad key secret-123\"}".getBytes(StandardCharsets.UTF_8), null));
        routes.put("GET login.smoobu.com/api/apartments", apartments);
        assertThatThrownBy(() -> connectors(routes).pull("smoobu", Map.of("apiKey", "secret-123"), FROM, TO))
            .hasMessage("API_AUTH");
        assertThat(sleeps).containsExactly(2000L);
        assertThat(sent.getFirst().headers()).containsEntry("Api-Key", "secret-123");
    }

    @Test void credentialsAndWindowAreRequiredAndVendorsAreFixed() {
        var connectors = connectors(Map.of());
        assertThatThrownBy(() -> connectors.pull("guesty", Map.of("clientId", "x"), FROM, TO)).hasMessage("API_CREDENTIALS_REQUIRED");
        assertThatThrownBy(() -> connectors.pull("smoobu", Map.of("apiKey", "x"), TO, FROM)).hasMessage("API_WINDOW_INVALID");
        assertThatThrownBy(() -> connectors.pull("evil.example", Map.of(), FROM, TO)).hasMessage("API_VENDOR_UNSUPPORTED");
        assertThat(sent).isEmpty();
    }

    @Test void paginationLinksCannotRedirectCredentialsToAnotherHost() {
        var routes = new HashMap<String, Deque<PmsApiTransport.Response>>();
        routes.put("GET api.ownerrez.com/v2/properties", ok(
            "{\"items\":[{\"id\":1,\"name\":\"Chalet\"}],\"next_page_url\":\"https://attacker.example/steal\"}"));
        assertThatThrownBy(() -> connectors(routes).pull("ownerrez", Map.of("email", "a@b.c", "token", "pat"), FROM, TO))
            .hasMessage("API_RESPONSE_UNEXPECTED");
        assertThat(sent).hasSize(1);
    }

    @Test void beds24FollowsNextPageAndUsesPropertyCurrency() {
        var routes = new HashMap<String, Deque<PmsApiTransport.Response>>();
        routes.put("GET api.beds24.com/v2/properties", ok("{\"data\":[{\"id\":7,\"name\":\"Gîte\",\"currency\":\"EUR\",\"country\":\"FR\"}],\"pages\":{\"nextPageExists\":false}}"));
        routes.put("GET api.beds24.com/v2/bookings", ok(
            "{\"data\":[{\"id\":1,\"propertyId\":7,\"firstName\":\"Ana\",\"lastName\":\"B\",\"arrival\":\"2026-05-01\",\"departure\":\"2026-05-03\",\"price\":200,\"status\":\"confirmed\"}],\"pages\":{\"nextPageExists\":true}}",
            "{\"data\":[{\"id\":2,\"propertyId\":7,\"firstName\":\"Bo\",\"arrival\":\"2026-06-01\",\"departure\":\"2026-06-03\",\"price\":180,\"status\":\"cancelled\"}],\"pages\":{\"nextPageExists\":false}}"));
        var pull = connectors(routes).pull("beds24", Map.of("token", "tk"), FROM, TO);
        var reservations = pull.documents().stream().filter(d -> d.name().startsWith("Réservations")).findFirst().orElseThrow();
        assertThat(reservations.rows()).extracting(r -> r.get("currency")).containsExactly("EUR", "EUR");
        assertThat(reservations.rows()).extracting(r -> r.get("guestName")).containsExactly("Ana B", "Bo");
    }
}
