package com.clenzy.integration.baitlyiot;

import com.clenzy.model.NoiseDevice;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.NoiseDeviceRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BaitlyIotSensorServiceTest {
    @Mock BaitlyIotAccessService access;
    @Mock BaitlyIotClient iot;
    @Mock NoiseDeviceRepository devices;
    BaitlyIotSensorService service;
    UUID externalId = UUID.randomUUID();

    @BeforeEach
    void setup() {
        service = new BaitlyIotSensorService(access, iot, devices);
        lenient().when(iot.simulatorsEnabled()).thenReturn(true);
    }

    @Test
    void whenCallerCannotManageProperty_thenDoesNotProvisionRemoteDevice() {
        when(access.property(11, "host")).thenThrow(new AccessDeniedException("Forbidden"));
        assertThatThrownBy(() -> service.create(input(), "host")).isInstanceOf(AccessDeniedException.class);
        verify(iot, never()).ensureSimulator(any(), anyLong(), any());
        verifyNoInteractions(devices);
    }

    @Test
    void whenCreatingSimulator_thenPersistsSyntheticFlagAndTrustedOrganization() {
        Property property = new Property(); property.setId(11L); property.setOrganizationId(7L);
        when(access.property(11, "host")).thenReturn(property);
        when(iot.ensureSimulator(eq(externalId), eq(7L), any())).thenReturn(remote(true, false));
        when(devices.saveAndFlush(any())).thenAnswer(invocation -> {
            NoiseDevice value = invocation.getArgument(0); value.setId(99L); return value;
        });
        assertThat(service.create(input(), "host").id()).isEqualTo(99);
        var captured = org.mockito.ArgumentCaptor.forClass(NoiseDevice.class);
        verify(devices).saveAndFlush(captured.capture());
        assertThat(captured.getValue().isSimulation()).isTrue();
        assertThat(captured.getValue().getOrganizationId()).isEqualTo(7);
    }

    @Test
    void whenAttachingRegisteredPhysicalDevice_thenDoesNotCreateDeviceOrSimulatorInIot() {
        Property property = new Property(); property.setId(11L); property.setOrganizationId(7L);
        when(access.property(11, "host")).thenReturn(property);
        when(iot.requireProperty(externalId.toString(), 7, 11)).thenReturn(remote(false, false));
        when(devices.saveAndFlush(any())).thenAnswer(call -> {
            NoiseDevice value = call.getArgument(0); value.setId(99L); return value;
        });
        assertThat(service.attach(attachment(), "host").id()).isEqualTo(99);
        var captured = org.mockito.ArgumentCaptor.forClass(NoiseDevice.class);
        verify(devices).saveAndFlush(captured.capture());
        assertThat(captured.getValue().isSimulation()).isFalse();
        assertThat(captured.getValue().getExternalDeviceId()).isEqualTo(externalId.toString());
        verify(iot, never()).ensureSimulator(any(), anyLong(), any());
    }

    @Test
    void whenCallerDoesNotOwnProperty_thenCannotAttachMarketDevice() {
        when(access.property(11, "other-host")).thenThrow(new AccessDeniedException("Forbidden"));
        assertThatThrownBy(() -> service.attach(attachment(), "other-host")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(iot, devices);
    }

    @Test
    void whenRegisteredDeviceDoesNotMatchProperty_thenNoLocalAttachment() {
        Property property = new Property(); property.setId(11L); property.setOrganizationId(7L);
        when(access.property(11, "host")).thenReturn(property);
        when(iot.requireProperty(externalId.toString(), 7, 11)).thenThrow(new IllegalArgumentException("Wrong property"));
        assertThatThrownBy(() -> service.attach(attachment(), "host")).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(devices);
    }

    @Test
    void whenIdentifierBelongsToSimulator_thenCannotPresentItAsPhysicalDevice() {
        Property property = new Property(); property.setId(11L); property.setOrganizationId(7L);
        when(access.property(11, "host")).thenReturn(property);
        when(iot.requireProperty(externalId.toString(), 7, 11)).thenReturn(remote(true, false));
        assertThatThrownBy(() -> service.attach(attachment(), "host")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(devices);
    }

    private BaitlyIotSensorService.Attach attachment() {
        return new BaitlyIotSensorService.Attach(externalId, 11, "Sonometre salon", "Salon");
    }

    @Test
    void whenCreateIsRetried_thenReturnsSameLocalDevice() {
        Property property = new Property(); property.setId(11L); property.setOrganizationId(7L);
        when(access.property(11, "host")).thenReturn(property);
        when(iot.ensureSimulator(eq(externalId), eq(7L), any())).thenReturn(remote(true, false));
        NoiseDevice existing = local();
        when(devices.findByDeviceTypeAndExternalDeviceId(NoiseDevice.DeviceType.BAITLY, externalId.toString()))
                .thenReturn(Optional.of(existing));
        assertThat(service.create(input(), "host").id()).isEqualTo(99);
        verify(devices, never()).saveAndFlush(any());
    }

    @Test
    void whenPhysicalDeviceIsSelected_thenDoesNotSendSyntheticMeasurement() {
        NoiseDevice local = local(); local.setSimulation(false);
        when(access.device(99, "host")).thenReturn(local);
        when(iot.getDevice(externalId.toString(), 7)).thenReturn(remote(false, false));
        assertThatThrownBy(() -> service.simulate(99, sample(), "host")).isInstanceOf(ResponseStatusException.class);
        verify(iot, never()).simulate(anyString(), anyLong(), any());
    }

    @Test
    void whenSimulating_thenKeepsRequestIdentityAndTimestampForRetries() {
        when(access.device(99, "host")).thenReturn(local());
        when(iot.getDevice(externalId.toString(), 7)).thenReturn(remote(true, false));
        var sample = sample();
        service.simulate(99, sample, "host");
        verify(iot).simulate(externalId.toString(), 7,
                new BaitlyIotClient.Sample(sample.eventId(), sample.measuredAt(), 10, 62));
    }

    @Test
    void whenErasureFails_thenDoesNotDeleteLocalDevice() {
        when(access.device(99, "host")).thenReturn(local());
        doThrow(new org.springframework.web.client.ResourceAccessException("unavailable"))
                .when(iot).requestErasure(externalId.toString(), 7);
        assertThatThrownBy(() -> service.delete(99, "host"))
                .isInstanceOf(org.springframework.web.client.RestClientException.class);
        verify(devices, never()).delete(any());
    }

    @Test
    void whenDeleting_thenRequestsRemoteErasureBeforeRemovingLocalRecord() {
        NoiseDevice local = local();
        when(access.device(99, "host")).thenReturn(local);
        service.delete(99, "host");
        var order = inOrder(iot, devices);
        order.verify(iot).requestErasure(externalId.toString(), 7);
        order.verify(devices).delete(local);
    }

    @Test
    void whenSimulatorsAreDisabled_thenNoSyntheticDeviceOrMeasurementCanBeCreated() {
        when(iot.simulatorsEnabled()).thenReturn(false);
        assertThatThrownBy(() -> service.create(input(), "host")).isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(403));
        assertThatThrownBy(() -> service.simulate(99, sample(), "host")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(access, devices);
        verify(iot, never()).ensureSimulator(any(), anyLong(), any());
        verify(iot, never()).simulate(anyString(), anyLong(), any());
    }

    @Test
    void whenRegisteringPhysicalDevice_thenOwnerKeepsItAndSecretIsReturnedOnce() {
        User owner = new User(); owner.setKeycloakId("owner-1");
        Property property = new Property(); property.setId(11L); property.setOrganizationId(7L); property.setOwner(owner);
        when(access.property(11, "admin")).thenReturn(property);
        when(iot.ensurePhysical(eq(externalId), eq(7L), eq(new BaitlyIotClient.Registration(11, "Entree", 120))))
                .thenReturn(remote(false, false));
        when(devices.saveAndFlush(any())).thenAnswer(call -> { NoiseDevice value = call.getArgument(0); value.setId(99L); return value; });
        when(iot.rotate(externalId.toString(), 7)).thenReturn(new BaitlyIotClient.Credentials(remote(false, false), "s".repeat(43)));
        when(iot.ingestionUrl()).thenReturn("https://iot.example.com");
        var provisioned = service.register(new BaitlyIotSensorService.Register(externalId, 11, "Entree", null, 120), "admin");
        assertThat(provisioned.token()).hasSize(43);
        assertThat(provisioned.mqttIdentity()).isEqualTo("c".repeat(64));
        assertThat(provisioned.ingestionUrl()).isEqualTo("https://iot.example.com");
        assertThat(provisioned.toString()).doesNotContain(provisioned.token());
        var captured = org.mockito.ArgumentCaptor.forClass(NoiseDevice.class);
        verify(devices).saveAndFlush(captured.capture());
        assertThat(captured.getValue().getUserId()).isEqualTo("owner-1");
        assertThat(captured.getValue().isSimulation()).isFalse();
        var order = inOrder(iot, devices);
        order.verify(iot).ensurePhysical(any(), anyLong(), any());
        order.verify(devices).saveAndFlush(any());
        order.verify(iot).rotate(externalId.toString(), 7);
    }

    @Test
    void whenPhysicalRegistrationIsRetried_thenReusesLinkAndIssuesAFreshSecret() {
        Property property = new Property(); property.setId(11L); property.setOrganizationId(7L);
        when(access.property(11, "host")).thenReturn(property);
        when(iot.ensurePhysical(eq(externalId), eq(7L), any())).thenReturn(remote(false, false));
        NoiseDevice existing = local(); existing.setSimulation(false); existing.setName("Entree"); existing.setRoomName(null);
        when(devices.findByDeviceTypeAndExternalDeviceId(NoiseDevice.DeviceType.BAITLY, externalId.toString()))
                .thenReturn(Optional.of(existing));
        when(iot.rotate(externalId.toString(), 7)).thenReturn(new BaitlyIotClient.Credentials(remote(false, false), "t".repeat(43)));
        assertThat(service.register(new BaitlyIotSensorService.Register(externalId, 11, "Entree", null, null), "host").id()).isEqualTo(99);
        verify(devices, never()).saveAndFlush(any());
    }

    @Test
    void whenPhysicalDeviceNeedsANewSecretOrMqttIdentity_thenOnlyActiveDevicesQualify() {
        NoiseDevice local = local(); local.setSimulation(false);
        when(access.device(99, "host")).thenReturn(local);
        when(iot.getDevice(externalId.toString(), 7)).thenReturn(remote(false, false));
        when(iot.rotate(externalId.toString(), 7)).thenReturn(new BaitlyIotClient.Credentials(remote(false, false), "u".repeat(43)));
        when(iot.rotateMqttIdentity(externalId.toString(), 7)).thenReturn(new BaitlyIotClient.MqttIdentity("d".repeat(64)));
        assertThat(service.credentials(99, "host").token()).hasSize(43);
        assertThat(service.mqttIdentity(99, "host").mqttIdentity()).isEqualTo("d".repeat(64));
        when(iot.getDevice(externalId.toString(), 7)).thenReturn(remote(false, true));
        assertThatThrownBy(() -> service.credentials(99, "host")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.mqttIdentity(99, "host")).isInstanceOf(ResponseStatusException.class);
    }


    private BaitlyIotSensorService.Create input() {
        return new BaitlyIotSensorService.Create(externalId, 11, "Salon test", "Salon");
    }
    private BaitlyIotSensorService.Simulate sample() {
        return new BaitlyIotSensorService.Simulate(UUID.randomUUID(), Instant.parse("2026-10-16T12:00:00Z"), 62.0);
    }
    private NoiseDevice local() {
        NoiseDevice value = new NoiseDevice(); value.setId(99L); value.setOrganizationId(7L); value.setPropertyId(11L);
        value.setDeviceType(NoiseDevice.DeviceType.BAITLY); value.setName("Salon test"); value.setRoomName("Salon");
        value.setExternalDeviceId(externalId.toString()); value.setSimulation(true); return value;
    }
    private BaitlyIotClient.Device remote(boolean simulation, boolean revoked) {
        return new BaitlyIotClient.Device(externalId, 7, 11, "Salon test", revoked, 60, null, null, false, simulation, "c".repeat(64));
    }
}
