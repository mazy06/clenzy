package com.baitly.iot;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.mock.env.MockEnvironment;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class IngressSecurityTest {
    private static final String SERVICE = "a-valid-test-service-secret-with-32-characters";

    @Test void whenCallingPublicManagementOrSpoofingPortHeaders_thenNoDatabaseAccess() throws Exception {
        var repository = mock(DeviceRepository.class);
        var request = request("GET", "/internal/v1/organizations/1/devices");
        request.addHeader("Authorization", "Bearer " + SERVICE);
        request.addHeader("Host", "127.0.0.1:8096");
        request.addHeader("Forwarded", "host=127.0.0.1:8096;proto=https");
        assertThat(filter(repository, request).getStatus()).isEqualTo(404);
        verifyNoInteractions(repository);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test void whenOversizedChunkedBodyOrDuplicateAuthorization_thenNoDatabaseAccess() throws Exception {
        var repository = mock(DeviceRepository.class);
        var request = request("POST", "/api/v1/measurements");
        request.addHeader("Authorization", "Bearer " + "a".repeat(43));
        request.setContent(new byte[4097]);
        assertThat(filter(repository, request).getStatus()).isEqualTo(413);
        var ambiguous = request("POST", "/api/v1/measurements");
        ambiguous.addHeader("Authorization", "Bearer " + "a".repeat(43));
        ambiguous.addHeader("Authorization", "Bearer " + "b".repeat(43));
        assertThat(filter(repository, ambiguous).getStatus()).isEqualTo(401);
        verifyNoInteractions(repository);
    }

    @Test void whenPeerFloodsWithChangingHeaders_thenQuotaStopsDatabaseLookups() throws Exception {
        var repository = mock(DeviceRepository.class);
        var limits = new IngressLimits(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
        for (int index = 0; index < 240; index++) assertThat(limits.acceptPeer("proxy")).isTrue();
        var filter = new IotSecurityConfiguration.TokenFilter(repository, new DeviceSecrets(),
                new DeviceSecrets().hash(SERVICE), limits, metrics(), 8096);
        var request = request("POST", "/api/v1/measurements");
        request.setRemoteAddr("proxy");
        request.addHeader("Authorization", "Bearer " + "a".repeat(43));
        request.addHeader("X-Forwarded-For", "new-ip");
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> fail("Throttled request reached the controller"));
        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getHeader("Retry-After")).isEqualTo("60");
        verifyNoInteractions(repository);
    }

    @Test void whenManyDistinctKeysArrive_thenLimiterMemoryIsBoundedAndExpires() {
        class MutableClock extends Clock {
            long millis;
            @Override public Instant instant() { return Instant.ofEpochMilli(millis); }
            @Override public long millis() { return millis; }
            @Override public ZoneId getZone() { return ZoneOffset.UTC; }
            @Override public Clock withZone(ZoneId zone) { return this; }
        }
        var clock = new MutableClock();
        var window = new IngressLimits.Window(clock, 2, 2);
        assertThat(window.accept("one")).isTrue();
        assertThat(window.accept("two")).isTrue();
        assertThat(window.accept("three")).isFalse();
        assertThat(window.accept("one")).isTrue();
        assertThat(window.accept("one")).isFalse();
        clock.millis = 60_000;
        assertThat(window.accept("three")).isTrue();
        var limits = new IngressLimits(clock);
        var device = DeviceIdentity.http(UUID.randomUUID(), "hash");
        for (int index = 0; index < 12; index++) assertThat(limits.acceptDevice(device)).isTrue();
        assertThat(limits.acceptDevice(device)).isFalse();
        // Rotating the credential or switching transport cannot evade the device's quota.
        assertThat(limits.acceptDevice(DeviceIdentity.http(device.id(), "rotated"))).isFalse();
        assertThat(limits.acceptDevice(DeviceIdentity.mqtt(device.id(), "certificate"))).isFalse();
    }

    @Test void whenOnePeerIsThrottled_thenItCannotExhaustTheGlobalBudgetOfOtherDevices() {
        var limits = new IngressLimits(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), 300, 240, 12, 16, false);
        for (int index = 0; index < 240; index++) assertThat(limits.acceptPeer("203.0.113.9")).isTrue();
        for (int index = 0; index < 5000; index++) assertThat(limits.acceptPeer("203.0.113.9")).isFalse();
        for (int index = 0; index < 60; index++) assertThat(limits.acceptPeer("198.51.100.7")).isTrue();
    }

    @Test void whenTheEdgeProxyIsOnLoopback_thenTheFleetIsNotCappedAtOneAddressQuota() {
        var behindEdge = new IngressLimits(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), 6000, 240, 12, 16, true);
        for (int index = 0; index < 1000; index++) assertThat(behindEdge.acceptPeer("127.0.0.1")).isTrue();
        // A routable peer keeps its own quota even when the edge mode is enabled.
        for (int index = 0; index < 240; index++) assertThat(behindEdge.acceptPeer("203.0.113.9")).isTrue();
        assertThat(behindEdge.acceptPeer("203.0.113.9")).isFalse();
        var direct = new IngressLimits(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), 6000, 240, 12, 16, false);
        for (int index = 0; index < 240; index++) assertThat(direct.acceptPeer("127.0.0.1")).isTrue();
        assertThat(direct.acceptPeer("127.0.0.1")).isFalse();
    }

    @Test void whenMqttMeasurementsArrive_thenOnlyTheGlobalAndDeviceBudgetsApply() {
        var limits = new IngressLimits(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), 6000, 240, 12, 65536, false);
        for (int index = 0; index < 1000; index++) assertThat(limits.acceptBroker()).isTrue();
    }

    @Test void whenHealthOrMetricsAreRequested_thenOnlyLoopbackOnThePrivatePortReachesThem() throws Exception {
        var repository = mock(DeviceRepository.class);
        var local = new MockHttpServletRequest("GET", "/actuator/health");
        local.setLocalPort(8096);
        local.setRemoteAddr("127.0.0.1");
        var passed = new java.util.concurrent.atomic.AtomicBoolean();
        new IotSecurityConfiguration.TokenFilter(repository, new DeviceSecrets(), new DeviceSecrets().hash(SERVICE),
                new IngressLimits(Clock.systemUTC()), metrics(), 8096)
                .doFilter(local, new MockHttpServletResponse(), (req, res) -> passed.set(true));
        assertThat(passed).isTrue();
        var remote = new MockHttpServletRequest("GET", "/actuator/prometheus");
        remote.setLocalPort(8096);
        remote.setRemoteAddr("192.0.2.10");
        assertThat(filter(repository, remote).getStatus()).isEqualTo(404);
        var publicPort = new MockHttpServletRequest("GET", "/actuator/health");
        publicPort.setLocalPort(8095);
        publicPort.setRemoteAddr("127.0.0.1");
        assertThat(filter(repository, publicPort).getStatus()).isEqualTo(404);
        var otherEndpoint = new MockHttpServletRequest("GET", "/actuator/env");
        otherEndpoint.setLocalPort(8096);
        otherEndpoint.setRemoteAddr("127.0.0.1");
        assertThat(filter(repository, otherEndpoint).getStatus()).isEqualTo(404);
        verifyNoInteractions(repository);
    }

    @Test void whenNetworkBindingIsNotLocal_thenHardenedProfileIsRequired() {
        var environment = new MockEnvironment().withProperty("server.address", "0.0.0.0");
        assertThatThrownBy(() -> new IotDeploymentGuard(environment).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class);
        environment.setActiveProfiles("hardened");
        assertThatCode(() -> new IotDeploymentGuard(environment).afterPropertiesSet()).doesNotThrowAnyException();
        assertThatThrownBy(() -> new RuntimeDatabaseGuard(mock(org.springframework.jdbc.core.JdbcTemplate.class), true)
                .afterPropertiesSet()).isInstanceOf(IllegalStateException.class);
    }

    private static IngressMetrics metrics() {
        return new IngressMetrics(new io.micrometer.core.instrument.simple.SimpleMeterRegistry());
    }

    private MockHttpServletRequest request(String method, String path) {
        var request = new MockHttpServletRequest(method, path);
        request.setLocalPort(8095);
        request.setContentType("application/json");
        return request;
    }

    private MockHttpServletResponse filter(DeviceRepository repository, MockHttpServletRequest request) throws Exception {
        var secrets = new DeviceSecrets();
        var filter = new IotSecurityConfiguration.TokenFilter(repository, secrets, secrets.hash(SERVICE),
                new IngressLimits(Clock.systemUTC()), metrics(), 8096);
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> fail("Rejected request reached the controller"));
        return response;
    }
}
