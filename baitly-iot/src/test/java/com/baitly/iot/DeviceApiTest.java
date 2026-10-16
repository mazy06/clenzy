package com.baitly.iot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=${BAITLY_IOT_TEST_DATABASE_URL}",
        "spring.datasource.username=${BAITLY_IOT_TEST_DATABASE_USER}",
        "spring.datasource.password=${BAITLY_IOT_TEST_DATABASE_PASSWORD:}",
        "baitly.iot.service-token=integration-test-service-key-never-use-outside-tests",
        // Spring Boot tests disable metric export by default; the Prometheus endpoint is under test here.
        "management.defaults.metrics.export.enabled=true"
})
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "BAITLY_IOT_TEST_DATABASE_URL", matches = ".+")
class DeviceApiTest {
    private static final int INTERNAL_PORT = freePort();
    @DynamicPropertySource static void ports(DynamicPropertyRegistry registry) {
        registry.add("baitly.iot.internal-port", () -> INTERNAL_PORT);
    }
    private static int freePort() {
        try (var socket = new ServerSocket(0)) { return socket.getLocalPort(); }
        catch (java.io.IOException error) { throw new IllegalStateException(error); }
    }
    private static final String SERVICE = "Bearer integration-test-service-key-never-use-outside-tests";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired WebApplicationContext context;
    @Autowired DeviceService service;
    @LocalServerPort int publicPort;

    @BeforeEach
    void cleanDatabase() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity())
                .defaultRequest(get("/").with(request -> {
                    request.setLocalPort(request.getRequestURI().startsWith("/internal/") ? INTERNAL_PORT : publicPort);
                    return request;
                })).build();
        jdbc.update("DELETE FROM baitly_iot_noise_measurements");
        jdbc.update("DELETE FROM baitly_iot_devices");
    }

    @Test
    void whenCallingRealSockets_thenManagementAndIngestionCannotCrossPorts() throws Exception {
        var http = HttpClient.newHttpClient();
        String internal = "/internal/v1/organizations/1/devices";
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + publicPort + internal))
                .header("Authorization", SERVICE).header("Forwarded", "host=127.0.0.1:" + INTERNAL_PORT + ";proto=https")
                .header("X-Forwarded-Host", "127.0.0.1:" + INTERNAL_PORT).GET().build();
        assertThat(http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(404);
        var privateRequest = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + INTERNAL_PORT + internal))
                .header("Authorization", SERVICE).GET().build();
        assertThat(http.send(privateRequest, HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(200);
        var wrongPort = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + INTERNAL_PORT + "/api/v1/measurements"))
                .header("Authorization", SERVICE).POST(HttpRequest.BodyPublishers.ofString("{}")).build();
        assertThat(http.send(wrongPort, HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(404);
    }

    @Test
    void whenChunkedOversizedOrMalformedJsonArrivesOnRealSocket_thenRejectsWithoutWriting() throws Exception {
        var credentials = register(1);
        var http = HttpClient.newHttpClient();
        var target = URI.create("http://127.0.0.1:" + publicPort + "/api/v1/measurements");
        var oversized = HttpRequest.newBuilder(target).header("Authorization", bearer(credentials))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofInputStream(() -> new java.io.ByteArrayInputStream(new byte[4097]))).build();
        assertThat(http.send(oversized, HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(413);
        var invalid = HttpRequest.newBuilder(target).header("Authorization", bearer(credentials))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("{\"audio\":true}")).build();
        var result = http.send(invalid, HttpResponse.BodyHandlers.ofString());
        assertThat(result.statusCode()).isEqualTo(400);
        assertThat(result.body()).doesNotContain(credentials.path("token").asText(), "stackTrace", "SELECT", "INSERT");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_noise_measurements", Integer.class)).isZero();
    }

    @Test
    void whenOldIdentityWasResolvedBeforeRotation_thenTransactionStillRejectsIt() throws Exception {
        JsonNode credentials = register(1);
        UUID id = UUID.fromString(credentials.path("device").path("id").asText());
        var identity = DeviceIdentity.http(id, new DeviceSecrets().hash(credentials.path("token").asText()));
        service.rotate(id, 1);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.ingest(identity,
                new DeviceContracts.NoiseMeasurement(UUID.randomUUID(), Instant.now(), 10, 62.0)))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .satisfies(error -> assertThat(((org.springframework.web.server.ResponseStatusException) error).getStatusCode().value()).isEqualTo(401));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_noise_measurements", Integer.class)).isZero();
    }

    @Test
    void whenJsonContainsDuplicateFieldsOrTrailingDocuments_thenRejected() throws Exception {
        JsonNode credentials = register(1);
        String sample = measurement(Instant.now(), 60);
        send(credentials, sample + " {}", 400);
        send(credentials, sample.replace("\"windowSeconds\":", "\"windowSeconds\":10,\"windowSeconds\":"), 400);
    }

    @Test
    void whenAnonymous_thenAllEndpointsRejectAccess() throws Exception {
        mvc.perform(get("/internal/v1/organizations/1/devices")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/measurements").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void whenRegistered_thenSecretIsReturnedOnceAndStoredOnlyAsHash() throws Exception {
        JsonNode credentials = register(1);
        String token = credentials.path("token").asText();
        assertThat(token).hasSize(43);
        assertThat(jdbc.queryForObject("SELECT token_hash FROM baitly_iot_devices", String.class))
                .isEqualTo(new DeviceSecrets().hash(token)).isNotEqualTo(token);
        mvc.perform(get(devicePath(credentials, 1)).header("Authorization", SERVICE))
                .andExpect(status().isOk()).andExpect(jsonPath("token").doesNotExist())
                .andExpect(jsonPath("online").value(false));
    }

    @Test
    void whenDeviceTokenIsUsedForManagement_thenAccessIsDenied() throws Exception {
        JsonNode credentials = register(1);
        mvc.perform(get(devicePath(credentials, 1)).header("Authorization", bearer(credentials)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/measurements").header("Authorization", SERVICE)
                .contentType(MediaType.APPLICATION_JSON).content(measurement(Instant.now(), 60)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void whenWrongOrganizationIsUsed_thenReadHistoryAndRevokeReturnNotFound() throws Exception {
        JsonNode credentials = register(1);
        String wrongOrgPath = devicePath(credentials, 2);
        mvc.perform(get(wrongOrgPath).header("Authorization", SERVICE)).andExpect(status().isNotFound());
        mvc.perform(get(wrongOrgPath + "/measurements").header("Authorization", SERVICE)
                .param("from", Instant.now().minusSeconds(60).toString()).param("to", Instant.now().toString()))
                .andExpect(status().isNotFound());
        mvc.perform(delete(wrongOrgPath).header("Authorization", SERVICE)).andExpect(status().isNotFound());
    }

    @Test
    void whenRevoked_thenDeviceCannotIngestAgain() throws Exception {
        JsonNode credentials = register(1);
        mvc.perform(delete(devicePath(credentials, 1)).header("Authorization", SERVICE))
                .andExpect(status().isNoContent());
        send(credentials, measurement(Instant.now(), 60), 401);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_noise_measurements", Integer.class)).isZero();
    }

    @Test
    void whenRetried_thenExactlyOneMeasurementIsStored() throws Exception {
        JsonNode credentials = register(1);
        String sample = measurement(Instant.now(), 65);
        send(credentials, sample, 200);
        mvc.perform(post("/api/v1/measurements").header("Authorization", bearer(credentials))
                .contentType(MediaType.APPLICATION_JSON).content(sample))
                .andExpect(status().isOk()).andExpect(jsonPath("duplicate").value(true));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_noise_measurements", Integer.class)).isEqualTo(1);
    }

    @Test
    void whenEventIdIsReusedWithDifferentValue_thenConflictAndOriginalPreserved() throws Exception {
        JsonNode credentials = register(1);
        String sample = measurement(Instant.now(), 65);
        send(credentials, sample, 200);
        send(credentials, sample.replace("65.0", "80.0"), 409);
        assertThat(jdbc.queryForObject("SELECT laeq_db_a FROM baitly_iot_noise_measurements", Double.class)).isEqualTo(65);
    }

    @Test
    void whenConcurrentRetriesArrive_thenOnlyOneRowIsStored() throws Exception {
        JsonNode credentials = register(1);
        String sample = measurement(Instant.now(), 65);
        try (var executor = Executors.newFixedThreadPool(4)) {
            var calls = new ArrayList<Callable<Integer>>();
            for (int i = 0; i < 8; i++) {
                calls.add(() -> mvc.perform(post("/api/v1/measurements")
                        .header("Authorization", bearer(credentials)).contentType(MediaType.APPLICATION_JSON)
                        .content(sample)).andReturn().getResponse().getStatus());
            }
            for (var result : executor.invokeAll(calls)) {
                assertThat(result.get()).isEqualTo(200);
            }
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_noise_measurements", Integer.class)).isEqualTo(1);
    }

    @Test
    void whenOfflineBacklogArrives_thenHistoryIsStoredButDeviceIsNotMarkedOnline() throws Exception {
        JsonNode credentials = register(1);
        send(credentials, measurement(Instant.now().minusSeconds(3600), 65), 200);
        mvc.perform(get(devicePath(credentials, 1)).header("Authorization", SERVICE))
                .andExpect(status().isOk()).andExpect(jsonPath("online").value(false));
    }

    @Test
    void whenOlderMeasurementArrivesAfterFreshOne_thenLastMeasuredAtDoesNotGoBackwards() throws Exception {
        JsonNode credentials = register(1);
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        send(credentials, measurement(now, 50), 200);
        send(credentials, measurement(now.minusSeconds(3600), 65), 200);
        JsonNode device = json.readTree(mvc.perform(get(devicePath(credentials, 1)).header("Authorization", SERVICE))
                .andExpect(status().isOk()).andExpect(jsonPath("online").value(true))
                .andReturn().getResponse().getContentAsString());
        assertThat(Instant.parse(device.path("lastMeasuredAt").asText())).isEqualTo(now);
    }

    @Test
    void whenInvalidTimestampOrLevel_thenMeasurementIsRejected() throws Exception {
        JsonNode credentials = register(1);
        send(credentials, measurement(Instant.now().plusSeconds(120), 50), 400);
        send(credentials, measurement(Instant.now().minusSeconds(8 * 86400), 50), 400);
        send(credentials, measurement(Instant.now(), 151), 400);
        send(credentials, measurement(Instant.now(), -1), 400);
    }

    @Test
    void whenPayloadContainsTenantOrAudio_thenUnknownFieldsAreRejected() throws Exception {
        JsonNode credentials = register(1);
        String sample = measurement(Instant.now(), 50);
        send(credentials, sample.replace("{", "{\"organizationId\":2,"), 400);
        send(credentials, sample.replace("{", "{\"audio\":\"data\","), 400);
    }

    @Test
    void whenPayloadExceedsFourKilobytes_thenRejectsBeforeParsing() throws Exception {
        JsonNode credentials = register(1);
        send(credentials, " ".repeat(4097), 413);
    }

    @Test
    void whenQueryHasLimit_thenLatestValuesAreReturnedInChronologicalOrder() throws Exception {
        JsonNode credentials = register(1);
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        send(credentials, measurement(now.minusSeconds(30), 40), 200);
        send(credentials, measurement(now.minusSeconds(20), 50), 200);
        send(credentials, measurement(now.minusSeconds(10), 60), 200);
        mvc.perform(get(devicePath(credentials, 1) + "/measurements").header("Authorization", SERVICE)
                .param("from", now.minusSeconds(60).toString()).param("to", now.toString()).param("limit", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].laeqDbA").value(50)).andExpect(jsonPath("$[1].laeqDbA").value(60));
    }

    @Test
    void whenTimeRangeOrLimitIsInvalid_thenQueryIsRejected() throws Exception {
        JsonNode credentials = register(1);
        mvc.perform(get(devicePath(credentials, 1) + "/measurements").header("Authorization", SERVICE)
                .param("from", Instant.now().minusSeconds(8 * 86400).toString())
                .param("to", Instant.now().toString())).andExpect(status().isBadRequest());
    }

    private JsonNode register(long orgId) throws Exception {
        String body = "{\"propertyId\":11,\"name\":\"Capteur Baitly salon\",\"reportingIntervalSeconds\":60}";
        return json.readTree(mvc.perform(post("/internal/v1/organizations/" + orgId + "/devices")
                .header("Authorization", SERVICE).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void whenSimulatorRegistrationIsRetried_thenOnlyOneDeviceExists() throws Exception {
        UUID id = UUID.randomUUID();
        ensureSimulator(id, 1, 200);
        ensureSimulator(id, 1, 200);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_devices", Integer.class)).isEqualTo(1);
        ensureSimulator(id, 2, 404);
    }

    @Test
    void whenSimulatorIsUsed_thenMeasurementsArePersistedAndMarkedAsSynthetic() throws Exception {
        UUID id = UUID.randomUUID();
        ensureSimulator(id, 1, 200);
        String path = "/internal/v1/organizations/1/devices/" + id;
        String sample = measurement(Instant.now(), 62);
        mvc.perform(post(path + "/simulate").header("Authorization", SERVICE)
                .contentType(MediaType.APPLICATION_JSON).content(sample)).andExpect(status().isOk());
        mvc.perform(get(path).header("Authorization", SERVICE)).andExpect(status().isOk())
                .andExpect(jsonPath("simulation").value(true)).andExpect(jsonPath("online").value(true));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_noise_measurements", Integer.class)).isEqualTo(1);
    }

    @Test
    void whenPhysicalDeviceReceivesSimulationRequest_thenRejectsWithoutWriting() throws Exception {
        JsonNode credentials = register(1);
        mvc.perform(post(devicePath(credentials, 1) + "/simulate").header("Authorization", SERVICE)
                .contentType(MediaType.APPLICATION_JSON).content(measurement(Instant.now(), 62)))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_noise_measurements", Integer.class)).isZero();
    }

    @Test
    void whenCredentialsAreRotated_thenOldKeyCannotIngest() throws Exception {
        JsonNode original = register(1);
        JsonNode rotated = json.readTree(mvc.perform(post(devicePath(original, 1) + "/credentials")
                .header("Authorization", SERVICE)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        send(original, measurement(Instant.now(), 62), 401);
        send(rotated, measurement(Instant.now(), 62), 200);
    }

    @Test
    void whenSimulatorIsRevoked_thenNeitherSimulationNorRegistrationCanReactivateIt() throws Exception {
        UUID id = UUID.randomUUID();
        ensureSimulator(id, 1, 200);
        String path = "/internal/v1/organizations/1/devices/" + id;
        mvc.perform(delete(path).header("Authorization", SERVICE)).andExpect(status().isNoContent());
        mvc.perform(post(path + "/simulate").header("Authorization", SERVICE)
                .contentType(MediaType.APPLICATION_JSON).content(measurement(Instant.now(), 62)))
                .andExpect(status().isNotFound());
        ensureSimulator(id, 1, 409);
    }

    @Test
    void whenPhysicalRegistrationIsRetried_thenOneDeviceAndTheSecretComesOnlyFromRotation() throws Exception {
        UUID id = UUID.randomUUID();
        String body = "{\"propertyId\":11,\"name\":\"Capteur entree\",\"reportingIntervalSeconds\":60}";
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(put("/internal/v1/organizations/1/devices/physical/" + id).header("Authorization", SERVICE)
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isOk()).andExpect(jsonPath("token").doesNotExist())
                    .andExpect(jsonPath("simulation").value(false));
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_devices", Integer.class)).isEqualTo(1);
        ensureSimulator(id, 1, 409);
        JsonNode credentials = json.readTree(mvc.perform(post("/internal/v1/organizations/1/devices/" + id + "/credentials")
                .header("Authorization", SERVICE)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        send(credentials, measurement(Instant.now(), 55), 200);
    }

    @Test
    void whenHttpSecretRotates_thenMqttIdentityIsUnchangedAndViceVersa() throws Exception {
        JsonNode credentials = register(1);
        String identity = credentials.path("device").path("mqttIdentity").asText();
        assertThat(identity).matches("[a-f0-9]{64}").isNotEqualTo(new DeviceSecrets().hash(credentials.path("token").asText()));
        JsonNode rotated = json.readTree(mvc.perform(post(devicePath(credentials, 1) + "/credentials").header("Authorization", SERVICE))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(rotated.path("device").path("mqttIdentity").asText()).isEqualTo(identity);
        String next = json.readTree(mvc.perform(post(devicePath(credentials, 1) + "/mqtt-identity").header("Authorization", SERVICE))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("mqttIdentity").asText();
        assertThat(next).matches("[a-f0-9]{64}").isNotEqualTo(identity);
        UUID id = UUID.fromString(credentials.path("device").path("id").asText());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.ingest(DeviceIdentity.mqtt(id, identity),
                new DeviceContracts.NoiseMeasurement(UUID.randomUUID(), Instant.now(), 10, 60.0)))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThat(service.ingest(DeviceIdentity.mqtt(id, next),
                new DeviceContracts.NoiseMeasurement(UUID.randomUUID(), Instant.now(), 10, 60.0)).duplicate()).isFalse();
        send(rotated, measurement(Instant.now(), 61), 200);
    }

    @Test
    void whenErasureIsRequested_thenDeviceIsRevokedHiddenAndTheRequestIsIdempotent() throws Exception {
        JsonNode credentials = register(1);
        send(credentials, measurement(Instant.now(), 55), 200);
        mvc.perform(post(devicePath(credentials, 2) + "/erasure").header("Authorization", SERVICE)).andExpect(status().isNotFound());
        mvc.perform(post(devicePath(credentials, 1) + "/erasure").header("Authorization", SERVICE)).andExpect(status().isNoContent());
        mvc.perform(post(devicePath(credentials, 1) + "/erasure").header("Authorization", SERVICE)).andExpect(status().isNoContent());
        send(credentials, measurement(Instant.now(), 56), 401);
        mvc.perform(get(devicePath(credentials, 1)).header("Authorization", SERVICE)).andExpect(status().isNotFound());
        mvc.perform(get("/internal/v1/organizations/1/devices").header("Authorization", SERVICE))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void whenRetentionRuns_thenExpiredAndErasedDataIsDeletedAndRecentDataKept() throws Exception {
        JsonNode kept = register(1);
        JsonNode erased = register(1);
        send(kept, measurement(Instant.now(), 50), 200);
        send(erased, measurement(Instant.now(), 51), 200);
        UUID keptId = UUID.fromString(kept.path("device").path("id").asText());
        jdbc.update("INSERT INTO baitly_iot_noise_measurements (device_id, event_id, measured_at, received_at, window_seconds, laeq_db_a)"
                + " VALUES (?, ?, now() - interval '100 days', now() - interval '100 days', 10, 40)", keptId, UUID.randomUUID());
        mvc.perform(post(devicePath(erased, 1) + "/erasure").header("Authorization", SERVICE)).andExpect(status().isNoContent());
        var result = IotRetentionMain.purge(jdbc, java.time.Clock.systemUTC(), 90);
        assertThat(result).isEqualTo(new IotRetentionMain.Result(1, 1, 1));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_noise_measurements", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM baitly_iot_devices", Integer.class)).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> IotRetentionMain.purge(jdbc, java.time.Clock.systemUTC(), 7))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void whenHistoryIsReadForAnotherProperty_thenNotFound() throws Exception {
        JsonNode credentials = register(1);
        mvc.perform(get(devicePath(credentials, 1) + "/measurements").header("Authorization", SERVICE)
                .param("from", Instant.now().minusSeconds(60).toString()).param("to", Instant.now().toString())
                .param("propertyId", "12")).andExpect(status().isNotFound());
        mvc.perform(get(devicePath(credentials, 1) + "/measurements").header("Authorization", SERVICE)
                .param("from", Instant.now().minusSeconds(60).toString()).param("to", Instant.now().toString())
                .param("propertyId", "11")).andExpect(status().isOk());
    }

    @Test
    void whenHealthAndMetricsAreReadOnPrivateLoopback_thenServedWithoutSecrets() throws Exception {
        var http = HttpClient.newHttpClient();
        var health = http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + INTERNAL_PORT + "/actuator/health")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(health.statusCode()).isEqualTo(200);
        assertThat(health.body()).contains("UP").doesNotContain("jdbc", "postgres");
        JsonNode credentials = register(1);
        send(credentials, measurement(Instant.now(), 50), 200);
        var metrics = http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + INTERNAL_PORT + "/actuator/prometheus")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(metrics.statusCode()).isEqualTo(200);
        assertThat(metrics.body()).contains("baitly_iot_ingress").doesNotContain(credentials.path("token").asText(),
                credentials.path("device").path("id").asText());
        var publicHealth = http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + publicPort + "/actuator/health")).GET().build(),
                HttpResponse.BodyHandlers.discarding());
        assertThat(publicHealth.statusCode()).isEqualTo(404);
    }

    private void ensureSimulator(UUID id, long orgId, int expectedStatus) throws Exception {
        mvc.perform(put("/internal/v1/organizations/" + orgId + "/devices/simulators/" + id)
                .header("Authorization", SERVICE).contentType(MediaType.APPLICATION_JSON)
                .content("{\"propertyId\":11,\"name\":\"Baitly test\",\"reportingIntervalSeconds\":60}"))
                .andExpect(status().is(expectedStatus));
    }

    private void send(JsonNode credentials, String sample, int status) throws Exception {
        mvc.perform(post("/api/v1/measurements").header("Authorization", bearer(credentials))
                .contentType(MediaType.APPLICATION_JSON).content(sample)).andExpect(status().is(status));
    }

    private String bearer(JsonNode credentials) {
        return "Bearer " + credentials.path("token").asText();
    }

    private String devicePath(JsonNode credentials, long orgId) {
        return "/internal/v1/organizations/" + orgId + "/devices/" + credentials.path("device").path("id").asText();
    }

    private String measurement(Instant measuredAt, double level) {
        return "{\"eventId\":\"" + UUID.randomUUID() + "\",\"measuredAt\":\"" + measuredAt
                + "\",\"windowSeconds\":10,\"laeqDbA\":" + level + "}";
    }
}
