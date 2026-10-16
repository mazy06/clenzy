package com.clenzy.integration.baitlyiot;

import com.clenzy.model.NoiseDevice;
import com.clenzy.model.Property;
import com.clenzy.repository.NoiseDeviceRepository;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** HTTP orchestration stays outside transactions; each repository mutation owns a short transaction. */
@Service
public class BaitlyIotSensorService {
    private static final int DEFAULT_REPORTING_SECONDS = 60;
    private final BaitlyIotAccessService access;
    private final BaitlyIotClient iot;
    private final NoiseDeviceRepository devices;

    public BaitlyIotSensorService(BaitlyIotAccessService access, BaitlyIotClient iot, NoiseDeviceRepository devices) {
        this.access = access;
        this.iot = iot;
        this.devices = devices;
    }

    public record Create(@NotNull UUID requestId, @Positive long propertyId,
                         @NotBlank @Size(max = 120) String name, @Size(max = 120) String roomName) {}
    public record Register(@NotNull UUID requestId, @Positive long propertyId,
                           @NotBlank @Size(max = 120) String name, @Size(max = 120) String roomName,
                           @Min(10) @Max(3600) Integer reportingIntervalSeconds) {}
    public record Created(long id) {}
    public record Attach(@NotNull UUID externalDeviceId, @Positive long propertyId,
                         @NotBlank @Size(max = 120) String name, @Size(max = 120) String roomName) {}
    public record Simulate(@NotNull UUID eventId, @NotNull Instant measuredAt,
                           @NotNull @DecimalMin("0") @DecimalMax("150") Double laeqDbA) {}
    public record State(boolean simulation, boolean revoked, boolean online, Instant lastReceivedAt, Instant lastMeasuredAt,
                        boolean awaitingFirstMeasurement, int reportingIntervalSeconds, String externalDeviceId,
                        String mqttIdentity) {}
    public record Secret(String token) {
        @Override public String toString() { return "Baitly sensor secret [redacted]"; }
    }
    /** Returned once, right after registration: the only moment the device secret leaves the PMS. */
    public record Provisioned(long id, String externalDeviceId, String token, String mqttIdentity, String ingestionUrl) {
        @Override public String toString() { return "Baitly sensor provisioning [redacted]"; }
    }
    public record MqttIdentity(String mqttIdentity) {}

    public Created create(Create input, String requester) {
        requireSimulators();
        var property = access.property(input.propertyId(), requester);
        long orgId = property.getOrganizationId();
        var remote = iot.ensureSimulator(input.requestId(), orgId,
                new BaitlyIotClient.Registration(property.getId(), input.name().trim(), DEFAULT_REPORTING_SECONDS));
        requireRegistered(remote, property, true);
        return persist(input, property, requester, true);
    }

    /**
     * Registers a physical device for a property, then issues its secret. Retrying with the same
     * requestId reuses the registration and issues a fresh secret, so a lost response never strands it.
     */
    public Provisioned register(Register input, String requester) {
        var property = access.property(input.propertyId(), requester);
        long orgId = property.getOrganizationId();
        int interval = input.reportingIntervalSeconds() == null ? DEFAULT_REPORTING_SECONDS : input.reportingIntervalSeconds();
        var remote = iot.ensurePhysical(input.requestId(), orgId,
                new BaitlyIotClient.Registration(property.getId(), input.name().trim(), interval));
        requireRegistered(remote, property, false);
        var local = persist(new Create(input.requestId(), input.propertyId(), input.name(), input.roomName()), property, requester, false);
        var credentials = iot.rotate(input.requestId().toString(), orgId);
        if (credentials == null || credentials.token() == null || credentials.device() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY);
        }
        return new Provisioned(local.id(), input.requestId().toString(), credentials.token(),
                credentials.device().mqttIdentity(), iot.ingestionUrl());
    }

    public Created attach(Attach input, String requester) {
        var property = access.property(input.propertyId(), requester);
        var registered = iot.requireProperty(input.externalDeviceId().toString(), property.getOrganizationId(), property.getId());
        if (registered.simulation()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet identifiant appartient a un simulateur");
        }
        return persist(new Create(input.externalDeviceId(), input.propertyId(), input.name(), input.roomName()),
                property, requester, false);
    }

    private Created persist(Create input, Property property, String requester, boolean simulation) {
        NoiseDevice local = new NoiseDevice();
        local.setOrganizationId(property.getOrganizationId());
        local.setPropertyId(input.propertyId());
        // The owner keeps the device even when an administrator performed the setup.
        local.setUserId(property.getOwner() != null && property.getOwner().getKeycloakId() != null
                ? property.getOwner().getKeycloakId() : requester);
        local.setName(input.name().trim());
        local.setRoomName(input.roomName());
        local.setDeviceType(NoiseDevice.DeviceType.BAITLY);
        local.setExternalDeviceId(input.requestId().toString());
        local.setStatus(NoiseDevice.DeviceStatus.ACTIVE);
        local.setSimulation(simulation);
        var existing = devices.findByDeviceTypeAndExternalDeviceId(NoiseDevice.DeviceType.BAITLY, local.getExternalDeviceId());
        if (existing.isPresent()) return existing(input, requester, existing.get(), simulation);
        try {
            return new Created(devices.saveAndFlush(local).getId());
        } catch (DataIntegrityViolationException collision) {
            return existing(input, requester, devices.findByDeviceTypeAndExternalDeviceId(NoiseDevice.DeviceType.BAITLY,
                    local.getExternalDeviceId()).orElseThrow(() -> collision), simulation);
        }
    }

    public State state(long id, String requester) {
        var device = access.device(id, requester);
        var remote = remote(device);
        return new State(remote.simulation(), remote.revoked(), remote.online(), remote.lastReceivedAt(), remote.lastMeasuredAt(),
                remote.lastReceivedAt() == null, remote.reportingIntervalSeconds(), device.getExternalDeviceId(),
                remote.mqttIdentity());
    }

    public BaitlyIotClient.IngestionResult simulate(long id, Simulate input, String requester) {
        requireSimulators();
        var device = access.device(id, requester);
        var remote = remote(device);
        if (!device.isSimulation() || !remote.simulation() || remote.revoked()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce capteur ne peut pas recevoir de mesures de test");
        }
        return iot.simulate(device.getExternalDeviceId(), device.getOrganizationId(),
                new BaitlyIotClient.Sample(input.eventId(), input.measuredAt(), 10, input.laeqDbA()));
    }

    /** New device secret; the previous one stops working immediately. */
    public Secret credentials(long id, String requester) {
        var device = access.device(id, requester);
        var remote = remote(device);
        if (device.isSimulation() != remote.simulation()) throw new ResponseStatusException(HttpStatus.CONFLICT);
        if (device.isSimulation()) requireSimulators();
        if (remote.revoked()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Capteur revoque");
        var credentials = iot.rotate(device.getExternalDeviceId(), device.getOrganizationId());
        if (credentials == null || credentials.token() == null) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY);
        return new Secret(credentials.token());
    }

    /** New certificate CN to sign with the offline device CA; certificates for the previous CN stop writing. */
    public MqttIdentity mqttIdentity(long id, String requester) {
        var device = access.device(id, requester);
        var remote = remote(device);
        if (device.isSimulation() || remote.simulation() || remote.revoked()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Identite MQTT reservee aux appareils actifs");
        }
        var identity = iot.rotateMqttIdentity(device.getExternalDeviceId(), device.getOrganizationId());
        if (identity == null || identity.mqttIdentity() == null || !identity.mqttIdentity().matches("[a-f0-9]{64}")) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY);
        }
        return new MqttIdentity(identity.mqttIdentity());
    }

    public void revoke(long id, String requester) {
        var device = access.device(id, requester);
        remote(device);
        iot.revoke(device.getExternalDeviceId(), device.getOrganizationId());
        devices.markOffline(device.getId());
    }

    /**
     * Erasure first, local link second: on failure the link stays visible and the user retries.
     * The IoT request is idempotent, so a retry after a failed local delete succeeds.
     */
    public void delete(long id, String requester) {
        var device = access.device(id, requester);
        iot.requestErasure(device.getExternalDeviceId(), device.getOrganizationId());
        devices.delete(device);
    }

    private void requireSimulators() {
        if (!iot.simulatorsEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Les simulateurs sont desactives sur cet environnement");
        }
    }

    private static void requireRegistered(BaitlyIotClient.Device remote, Property property, boolean simulation) {
        if (remote == null || remote.organizationId() != property.getOrganizationId() || remote.propertyId() != property.getId()
                || remote.simulation() != simulation || remote.revoked()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY);
        }
    }

    private BaitlyIotClient.Device remote(NoiseDevice local) {
        var remote = iot.getDevice(local.getExternalDeviceId(), local.getOrganizationId());
        if (remote == null || remote.organizationId() != local.getOrganizationId() || remote.propertyId() != local.getPropertyId()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY);
        }
        return remote;
    }

    private Created existing(Create input, String requester, NoiseDevice device, boolean simulation) {
        access.device(device.getId(), requester);
        if (device.getPropertyId() != input.propertyId() || !device.getName().equals(input.name().trim())
                || !Objects.equals(device.getRoomName(), input.roomName()) || device.isSimulation() != simulation) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Identifiant de creation deja utilise");
        }
        return new Created(device.getId());
    }
}
