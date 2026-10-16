package com.baitly.iot;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Only trusted broker ACLs bind the certificate identity to this topic. Never expose as HTTP. */
@Component
public class MqttMeasurementIngress {
    private static final Pattern TOPIC = Pattern.compile("baitly/devices/([a-f0-9]{64})/measurements");
    private final DeviceRepository devices;
    private final DeviceService service;
    private final IngressLimits limits;
    private final ObjectMapper json;
    private final Validator validator;

    public MqttMeasurementIngress(DeviceRepository devices, DeviceService service, IngressLimits limits,
                                  ObjectMapper json, Validator validator) {
        this.devices = devices;
        this.service = service;
        this.limits = limits;
        this.json = json;
        this.validator = validator;
    }

    public record Receipt(UUID eventId, int status, boolean duplicate) {}

    public Receipt receive(String topic, byte[] payload, int qos, boolean retained) {
        var match = TOPIC.matcher(topic);
        if (!match.matches() || retained || qos != 1) return new Receipt(null, 400, false);
        if (payload.length == 0 || payload.length > 4096) return new Receipt(null, 413, false);
        if (!limits.acceptPeer("mqtt")) return new Receipt(null, 429, false);
        // CN = hash of the current device credential. Rotation invalidates previous certificates
        // for ingestion, including sessions still connected to the broker.
        var device = devices.authenticate(match.group(1));
        if (device.isEmpty()) return new Receipt(null, 401, false);
        var identity = new DeviceIdentity(device.get().id(), match.group(1));
        if (!limits.acceptDevice(identity)) return new Receipt(null, 429, false);
        DeviceContracts.NoiseMeasurement input;
        try {
            input = json.readValue(payload, DeviceContracts.NoiseMeasurement.class);
            if (input == null || !validator.validate(input).isEmpty()) return new Receipt(null, 400, false);
        } catch (java.io.IOException | IllegalArgumentException invalid) {
            return new Receipt(null, 400, false);
        }
        try {
            var result = service.ingest(identity, input);
            return new Receipt(result.eventId(), 200, result.duplicate());
        } catch (ResponseStatusException rejected) {
            return new Receipt(input.eventId(), rejected.getStatusCode().value(), false);
        }
        // Unexpected database failures propagate: no successful receipt is emitted.
    }
}
