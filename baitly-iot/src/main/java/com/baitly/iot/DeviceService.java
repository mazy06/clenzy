package com.baitly.iot;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static com.baitly.iot.DeviceContracts.*;

@Service
public class DeviceService {
    private final DeviceRepository repository;
    private final DeviceSecrets secrets;
    private final Clock clock;

    public DeviceService(DeviceRepository repository, DeviceSecrets secrets, Clock clock) {
        this.repository = repository;
        this.secrets = secrets;
        this.clock = clock;
    }

    @Transactional
    public DeviceCredentials register(long orgId, RegisterDevice input) {
        UUID id = UUID.randomUUID();
        String token = secrets.generate();
        repository.insert(newDevice(id, orgId, input, secrets.hash(token), false));
        return new DeviceCredentials(get(id, orgId), token);
    }

    public DeviceView get(UUID id, long orgId) {
        return view(requireDevice(id, orgId));
    }

    @Transactional
    public DeviceView ensureSimulator(UUID id, long orgId, RegisterDevice input) {
        return ensure(id, orgId, input, true);
    }

    /**
     * Idempotent registration under an identifier chosen by the PMS. No secret is returned here:
     * the PMS obtains it with {@link #rotate}, so a retried request never loses the only copy.
     */
    @Transactional
    public DeviceView ensurePhysical(UUID id, long orgId, RegisterDevice input) {
        return ensure(id, orgId, input, false);
    }

    private DeviceView ensure(UUID id, long orgId, RegisterDevice input, boolean simulation) {
        // The placeholder secret is never returned: nobody can authenticate before a rotation.
        repository.ensure(newDevice(id, orgId, input, secrets.hash(secrets.generate()), simulation));
        var device = requireDevice(id, orgId);
        if (device.simulation() != simulation || device.revoked() || device.propertyId() != input.propertyId()
                || !device.name().equals(input.name()) || device.reportingIntervalSeconds() != input.reportingIntervalSeconds()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Registration identifier already used");
        }
        return view(device);
    }

    @Transactional
    public DeviceCredentials rotate(UUID id, long orgId) {
        var locked = requireLocked(id, orgId);
        String token = secrets.generate();
        repository.rotate(id, orgId, secrets.hash(token));
        return new DeviceCredentials(view(locked), token);
    }

    /** New certificate CN: certificates issued for the previous one can no longer write. */
    @Transactional
    public MqttIdentity rotateMqttIdentity(UUID id, long orgId) {
        requireLocked(id, orgId);
        String identity = secrets.mqttIdentity();
        repository.rotateMqttIdentity(id, orgId, identity);
        return new MqttIdentity(identity);
    }

    @Transactional
    public IngestionResult simulate(UUID id, long orgId, NoiseMeasurement input) {
        var device = requireLocked(id, orgId);
        if (!device.simulation()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return persistMeasurement(device, input);
    }

    public List<DeviceView> list(long orgId) {
        return repository.list(orgId).stream().map(this::view).toList();
    }

    @Transactional
    public void revoke(UUID id, long orgId) {
        if (!repository.revoke(id, orgId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    /** Revokes and hides the device; the retention job deletes it with its measurements. */
    @Transactional
    public void requestErasure(UUID id, long orgId) {
        if (!repository.requestErasure(id, orgId, clock.instant())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    @Transactional
    public IngestionResult ingest(DeviceIdentity identity, NoiseMeasurement input) {
        var device = repository.lockAuthenticated(identity)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return persistMeasurement(device, input);
    }

    private IngestionResult persistMeasurement(DeviceRepository.Device device, NoiseMeasurement input) {
        UUID deviceId = device.id();
        input = new NoiseMeasurement(input.eventId(), input.measuredAt().truncatedTo(ChronoUnit.MICROS),
                input.windowSeconds(), input.laeqDbA());
        Instant now = clock.instant();
        validate(input, now);
        boolean inserted = repository.insertMeasurement(device.id(), input, now);
        if (!inserted) {
            requireIdenticalRetry(deviceId, input);
        }
        repository.touch(deviceId, now, input.measuredAt());
        return new IngestionResult(input.eventId(), !inserted);
    }

    /** propertyId, when given, must match: the PMS checks its own link in the same call. */
    public List<MeasurementView> measurements(UUID id, long orgId, Long propertyId, Instant from, Instant to, int limit) {
        var device = requireDevice(id, orgId);
        if (propertyId != null && device.propertyId() != propertyId) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (!from.isBefore(to) || Duration.between(from, to).compareTo(Duration.ofDays(7)) > 0
                || limit < 1 || limit > 10000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid time range or limit");
        }
        return repository.measurements(id, from, to, limit);
    }

    private void validate(NoiseMeasurement input, Instant now) {
        if (!Double.isFinite(input.laeqDbA()) || input.measuredAt().isAfter(now.plusSeconds(30))
                || input.measuredAt().isBefore(now.minus(Duration.ofDays(7)))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid measurement");
        }
    }

    private void requireIdenticalRetry(UUID deviceId, NoiseMeasurement input) {
        var previous = repository.measurement(deviceId, input.eventId()).orElseThrow();
        if (!previous.measuredAt().equals(input.measuredAt().truncatedTo(ChronoUnit.MICROS))
                || previous.windowSeconds() != input.windowSeconds()
                || Double.compare(previous.laeqDbA(), input.laeqDbA()) != 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Event identifier already used");
        }
    }

    private DeviceRepository.Device requireDevice(UUID id, long orgId) {
        return repository.find(id, orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private DeviceRepository.Device requireLocked(UUID id, long orgId) {
        var locked = repository.lock(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (locked.organizationId() != orgId || locked.revoked()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return locked;
    }

    private DeviceRepository.NewDevice newDevice(UUID id, long orgId, RegisterDevice input, String tokenHash, boolean simulation) {
        return new DeviceRepository.NewDevice(id, orgId, input, tokenHash, secrets.mqttIdentity(), simulation, clock.instant());
    }

    private DeviceView view(DeviceRepository.Device device) {
        Instant cutoff = clock.instant().minusSeconds(device.reportingIntervalSeconds() * 3L);
        boolean online = !device.revoked() && device.lastReceivedAt() != null && device.lastMeasuredAt() != null
                && !device.lastReceivedAt().isBefore(cutoff) && !device.lastMeasuredAt().isBefore(cutoff);
        return new DeviceView(device.id(), device.organizationId(), device.propertyId(), device.name(),
                device.revoked(), device.reportingIntervalSeconds(), device.lastReceivedAt(), device.lastMeasuredAt(),
                online, device.simulation(), device.mqttIdentity());
    }
}
