package com.clenzy.integration.baitlyiot;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class BaitlyIotClientTest {
    private static final String TOKEN = "baitly-test-service-token-never-use-in-production";
    private static final String ID = "b7d5efb8-2a94-4a78-b782-99d8ad2b3284";
    private BaitlyIotClient client;
    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        client = client("http://127.0.0.1:8095", TOKEN);
        server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(client, "http")).build();
    }

    private static BaitlyIotClient client(String baseUrl, String token) {
        return new BaitlyIotClient(baseUrl, token, "", false, 8, java.time.Clock.systemUTC());
    }

    @Test
    void whenLoadingNoise_thenUsesTrustedOrganizationAndPreservesUtcTimestamps() {
        server.expect(requestTo(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("/organizations/1/devices/" + ID + "/measurements?"),
                        org.hamcrest.Matchers.containsString("propertyId=11"))))
                .andExpect(method(HttpMethod.GET)).andExpect(header("Authorization", "Bearer " + TOKEN))
                .andRespond(withSuccess("""
                        [{"eventId":"b7d5efb8-2a94-4a78-b782-99d8ad2b3284","measuredAt":"2026-10-16T01:00:00Z",
                          "receivedAt":"2026-10-16T01:00:01Z","windowSeconds":10,"laeqDbA":64.5}]
                        """, MediaType.APPLICATION_JSON));
        var points = client.noise(ID, 1, 11, "2026-10-16T00:00:00Z", "2026-10-17T00:00:00Z", "Salon");
        assertThat(points).hasSize(1);
        assertThat(points.get(0).getTime()).isEqualTo("2026-10-16T01:00:00Z");
        assertThat(points.get(0).getDecibels()).isEqualTo(64.5);
        server.verify();
    }

    @Test
    void whenRemoteDeviceBelongsToAnotherProperty_thenIotRefusesTheHistoryInTheSameCall() {
        server.expect(requestTo(org.hamcrest.Matchers.containsString("propertyId=11"))).andRespond(withStatus(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> client.noise(ID, 1, 11, null, null, "Salon"))
                .isInstanceOf(RestClientException.class).hasMessageContaining("404");
        server.verify();
    }

    @Test
    void whenPeriodIsMalformedOrTooLong_thenRejectedAsBadRequestWithoutCallingIot() {
        assertThatThrownBy(() -> client.noise(ID, 1, 11, "hier", null, "Salon")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> client.noise(ID, 1, 11, "2026-10-01T00:00:00Z", "2026-10-09T00:00:01Z", "Salon"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> client.noise(ID, 1, 11, "2026-10-02T00:00:00Z", "2026-10-01T00:00:00Z", "Salon"))
                .isInstanceOf(IllegalArgumentException.class);
        server.verify();
    }

    @Test
    void whenRegisteringPhysicalDevice_thenUsesIdempotentPutWithoutReceivingASecret() {
        server.expect(requestTo("http://127.0.0.1:8095/internal/v1/organizations/1/devices/physical/" + ID))
                .andExpect(method(HttpMethod.PUT)).andExpect(header("Authorization", "Bearer " + TOKEN))
                .andRespond(withSuccess("{\"id\":\"" + ID + "\",\"organizationId\":1,\"propertyId\":11,\"simulation\":false,"
                        + "\"mqttIdentity\":\"" + "a".repeat(64) + "\"}", MediaType.APPLICATION_JSON));
        var device = client.ensurePhysical(java.util.UUID.fromString(ID), 1, new BaitlyIotClient.Registration(11, "Salon", 60));
        assertThat(device.simulation()).isFalse();
        assertThat(device.mqttIdentity()).hasSize(64);
        server.verify();
    }

    @Test
    void whenErasingOrRotatingMqttIdentity_thenCallsPrivateRoutes() {
        server.expect(requestTo("http://127.0.0.1:8095/internal/v1/organizations/1/devices/" + ID + "/erasure"))
                .andExpect(method(HttpMethod.POST)).andRespond(withStatus(HttpStatus.NO_CONTENT));
        server.expect(requestTo("http://127.0.0.1:8095/internal/v1/organizations/1/devices/" + ID + "/mqtt-identity"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"mqttIdentity\":\"" + "b".repeat(64) + "\"}", MediaType.APPLICATION_JSON));
        client.requestErasure(ID, 1);
        assertThat(client.rotateMqttIdentity(ID, 1).mqttIdentity()).isEqualTo("b".repeat(64));
        server.verify();
    }

    @Test
    void whenRemoteDeviceBelongsToAnotherOrganization_thenRejectsAttachment() {
        expectDevice(2, 11);
        assertThatThrownBy(() -> client.requireProperty(ID, 1, 11)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void whenIotRejectsRequest_thenFailureIsNotConvertedIntoEmptyHistory() {
        server.expect(requestTo(org.hamcrest.Matchers.containsString("/organizations/1/devices/" + ID + "/measurements")))
                .andRespond(withStatus(HttpStatus.FORBIDDEN).body(TOKEN));
        assertThatThrownBy(() -> client.noise(ID, 1, 11, null, null, "Salon"))
                .isInstanceOf(RestClientException.class).hasMessageContaining("403").hasMessageNotContaining(TOKEN);
    }

    @Test
    void whenConfigurationIsUnsafe_thenClientFailsClosed() {
        assertThatThrownBy(() -> client("http://iot.example.com", TOKEN))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> client("https://iot.example.com", "short"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> client("https://user:secret@iot.example.com", TOKEN))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> client("", "").getDevice(ID, 1))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new BaitlyIotClient("https://iot.example.com", TOKEN, "http://ingest.example.com", false, 8,
                java.time.Clock.systemUTC())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new BaitlyIotClient("https://iot.example.com", TOKEN, "", false, 0,
                java.time.Clock.systemUTC())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void whenProvisioningSimulator_thenUsesIdempotentPutAndOnlyServiceCredentials() {
        server.expect(requestTo("http://127.0.0.1:8095/internal/v1/organizations/1/devices/simulators/" + ID))
                .andExpect(method(HttpMethod.PUT)).andExpect(header("Authorization", "Bearer " + TOKEN))
                .andExpect(content().json("{\"propertyId\":11,\"name\":\"Salon\",\"reportingIntervalSeconds\":60}"))
                .andRespond(withSuccess("{\"id\":\"" + ID + "\",\"organizationId\":1,\"propertyId\":11,\"simulation\":true}", MediaType.APPLICATION_JSON));
        assertThat(client.ensureSimulator(java.util.UUID.fromString(ID), 1,
                new BaitlyIotClient.Registration(11, "Salon", 60)).simulation()).isTrue();
        server.verify();
    }

    @Test
    void whenUpstreamSendsOversizedBodyWithoutContentLength_thenPmsRejectsIt() {
        server.expect(anything()).andRespond(request -> new org.springframework.mock.http.client.MockClientHttpResponse(
                new java.io.ByteArrayInputStream(new byte[BoundedIotResponse.MAX_BYTES + 1]), HttpStatus.OK));
        assertThatThrownBy(() -> client.getDevice(ID, 1)).isInstanceOf(RestClientException.class);
        server.verify();
    }

    @Test
    void whenUpstreamSendsTrailingJson_thenPmsRejectsIt() {
        server.expect(anything()).andRespond(withSuccess("{\"id\":\"" + ID + "\"} {}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.getDevice(ID, 1)).isInstanceOf(RestClientException.class);
        server.verify();
    }

    @Test
    void whenUpstreamRedirects_thenPmsRejectsInsteadOfForwardingCredentials() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.FOUND)
                .location(java.net.URI.create("https://attacker.invalid/collect")));
        assertThatThrownBy(() -> client.getDevice(ID, 1)).isInstanceOf(RestClientException.class)
                .hasMessageContaining("302").hasMessageNotContaining(TOKEN);
        server.verify();
    }

    @Test
    void whenUpstreamChangesFormatToXml_thenNoXmlConverterIsUsed() {
        server.expect(anything()).andRespond(withSuccess("<Device><propertyId>11</propertyId></Device>", MediaType.APPLICATION_XML));
        assertThatThrownBy(() -> client.getDevice(ID, 1)).isInstanceOf(RestClientException.class);
        server.verify();
    }

    @Test
    void whenIotIsSaturated_thenNinthPmsCallFailsFastAndPermitsAreReleased() throws Exception {
        var started = new java.util.concurrent.CountDownLatch(8);
        var finish = new java.util.concurrent.CountDownLatch(1);
        server.expect(org.springframework.test.web.client.ExpectedCount.times(8), anything()).andRespond(request -> {
            started.countDown();
            try {
                if (!finish.await(5, java.util.concurrent.TimeUnit.SECONDS)) throw new java.io.IOException("Fixture timed out");
            } catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new java.io.IOException(error); }
            return withSuccess("{\"id\":\"" + ID + "\"}", MediaType.APPLICATION_JSON).createResponse(request);
        });
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(8)) {
            var calls = new java.util.ArrayList<java.util.concurrent.Future<BaitlyIotClient.Device>>();
            for (int index = 0; index < 8; index++) calls.add(executor.submit(() -> client.getDevice(ID, 1)));
            try {
                assertThat(started.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> client.getDevice(ID, 1)).isInstanceOf(RestClientException.class).hasMessageContaining("occupe");
            } finally { finish.countDown(); }
            for (var call : calls) assertThat(call.get(5, java.util.concurrent.TimeUnit.SECONDS)).isNotNull();
        }
        server.verify();
        server.reset();
        expectDevice(1, 11);
        assertThat(client.getDevice(ID, 1)).isNotNull();
        server.verify();
    }

    @Test
    void whenUpstreamSendsInvalidMeasurement_thenPmsDoesNotPublishIt() {
        server.expect(anything()).andRespond(withSuccess("""
                [{"eventId":"b7d5efb8-2a94-4a78-b782-99d8ad2b3284","measuredAt":"2026-10-16T01:00:00Z",
                  "receivedAt":"2026-10-16T01:00:01Z","windowSeconds":10,"laeqDbA":999999}]
                """, MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.noise(ID, 1, 11, "2026-10-16T00:00:00Z", "2026-10-17T00:00:00Z", "Salon"))
                .isInstanceOf(IllegalStateException.class);
        server.verify();
    }

    private void expectDevice(long orgId, long propertyId) {
        server.expect(requestTo("http://127.0.0.1:8095/internal/v1/organizations/1/devices/" + ID))
                .andRespond(withSuccess("{\"id\":\"" + ID + "\",\"organizationId\":" + orgId
                        + ",\"propertyId\":" + propertyId + ",\"revoked\":false}", MediaType.APPLICATION_JSON));
    }
}
