package com.baitly.iot;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MqttMeasurementIngressTest {
    private final DeviceRepository devices = mock(DeviceRepository.class);
    private final DeviceService service = mock(DeviceService.class);
    private final String hash = "a".repeat(64);
    private final String topic = "baitly/devices/" + hash + "/measurements";
    private MqttMeasurementIngress ingress;
    private ObjectMapper json;
    private final UUID id = UUID.randomUUID();

    @BeforeEach void setup() {
        var builder = new Jackson2ObjectMapperBuilder();
        new IotHttpConfiguration().boundedJson().customize(builder);
        json = builder.build();
        json.enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
        ingress = new MqttMeasurementIngress(devices, service, new IngressLimits(Clock.systemUTC()),
                new IngressMetrics(new io.micrometer.core.instrument.simple.SimpleMeterRegistry()), json,
                Validation.buildDefaultValidatorFactory().getValidator());
        when(devices.authenticateMqtt(hash)).thenReturn(Optional.of(new DeviceRepository.Device(id, 1, 11, "Test",
                false, 60, null, null, true, hash)));
    }

    @Test void bindsIdentityToBrokerTopicAndReturnsOnlyCommittedReceipt() throws Exception {
        UUID event = UUID.randomUUID();
        var input = new DeviceContracts.NoiseMeasurement(event, Instant.now(), 10, 62.4);
        when(service.ingest(DeviceIdentity.mqtt(id, hash), input))
                .thenReturn(new DeviceContracts.IngestionResult(event, true));
        assertThat(ingress.receive(topic, json.writeValueAsBytes(input), 1, false))
                .isEqualTo(new MqttMeasurementIngress.Receipt(event, 200, true));
    }

    @Test void rejectsWrongTopicRetainedQosAndLargeBodiesBeforeSql() {
        for (String invalid : new String[]{"baitly/devices/+/measurements", "baitly/devices/" + hash + "/commands",
                "baitly/devices/" + hash.toUpperCase() + "/measurements"}) {
            assertThat(ingress.receive(invalid, bytes("{}"), 1, false).status()).isEqualTo(400);
        }
        assertThat(ingress.receive(topic, bytes("{}"), 0, false).status()).isEqualTo(400);
        assertThat(ingress.receive(topic, bytes("{}"), 1, true).status()).isEqualTo(400);
        assertThat(ingress.receive(topic, new byte[4097], 1, false).status()).isEqualTo(413);
        verifyNoInteractions(devices, service);
    }

    @Test void unknownOrRevokedCredentialCannotPersist() {
        when(devices.authenticateMqtt(hash)).thenReturn(Optional.empty());
        assertThat(ingress.receive(topic, bytes("{}"), 1, false).status()).isEqualTo(401);
        verifyNoInteractions(service);
    }

    @Test void rejectsAmbiguousInvalidAndTenantSuppliedPayloads() {
        for (String payload : new String[]{"null", "{}", "{\"organizationId\":2}", "{} {}",
                "{\"windowSeconds\":1,\"windowSeconds\":2}", "{\"audio\":\"recording\"}"}) {
            assertThat(ingress.receive(topic, bytes(payload), 1, false).status()).isEqualTo(400);
        }
        verifyNoInteractions(service);
    }

    @Test void respectsTransactionalRevocationAndDoesNotTurnDatabaseFailureIntoSuccess() throws Exception {
        var payload = json.writeValueAsBytes(new DeviceContracts.NoiseMeasurement(UUID.randomUUID(), Instant.now(), 10, 50.0));
        when(service.ingest(any(), any())).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        assertThat(ingress.receive(topic, payload, 1, false).status()).isEqualTo(401);
        doThrow(new IllegalStateException("database unavailable")).when(service).ingest(any(), any());
        assertThatThrownBy(() -> ingress.receive(topic, payload, 1, false)).isInstanceOf(IllegalStateException.class);
    }

    @Test void boundsAttemptsPerDeviceIncludingInvalidMessages() {
        for (int i = 0; i < 12; i++) assertThat(ingress.receive(topic, bytes("{}"), 1, false).status()).isEqualTo(400);
        assertThat(ingress.receive(topic, bytes("{}"), 1, false).status()).isEqualTo(429);
        verifyNoInteractions(service);
    }

    @Test void httpSecretFingerprintIsNeverAcceptedAsMqttIdentity() {
        String tokenHash = "b".repeat(64);
        when(devices.authenticateMqtt(tokenHash)).thenReturn(Optional.empty());
        assertThat(ingress.receive("baitly/devices/" + tokenHash + "/measurements", bytes("{}"), 1, false).status()).isEqualTo(401);
        verify(devices, never()).authenticate(anyString());
    }

    @Test void overloadIsAnsweredWithoutTouchingTheDatabase() {
        assertThat(ingress.overloaded().status()).isEqualTo(429);
        verifyNoInteractions(devices, service);
    }

    private byte[] bytes(String value) { return value.getBytes(StandardCharsets.UTF_8); }
}
