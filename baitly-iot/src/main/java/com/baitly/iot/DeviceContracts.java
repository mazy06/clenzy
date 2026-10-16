package com.baitly.iot;

import java.time.Instant;
import java.util.UUID;
import jakarta.validation.constraints.*;

public final class DeviceContracts {
    private DeviceContracts() {}

    public record RegisterDevice(
            @Positive long propertyId,
            @NotBlank @Size(max = 120) String name,
            @Min(10) @Max(3600) int reportingIntervalSeconds) {}

    // mqttIdentity is the CN to sign with the offline device CA. It is not a credential.
    public record DeviceView(UUID id, long organizationId, long propertyId, String name,
                             boolean revoked, int reportingIntervalSeconds,
                             Instant lastReceivedAt, Instant lastMeasuredAt, boolean online, boolean simulation,
                             String mqttIdentity) {}

    public record DeviceCredentials(DeviceView device, String token) {
        @Override public String toString() { return "Baitly device credentials [redacted]"; }
    }

    // measuredAt is the UTC end of the LAeq integration window, never a display label.
    public record NoiseMeasurement(
            @NotNull UUID eventId,
            @NotNull Instant measuredAt,
            @Min(1) @Max(300) int windowSeconds,
            @NotNull @DecimalMin("0") @DecimalMax("150") Double laeqDbA) {}

    public record MeasurementView(UUID eventId, Instant measuredAt, Instant receivedAt,
                                  int windowSeconds, double laeqDbA) {}

    public record IngestionResult(UUID eventId, boolean duplicate) {}

    public record MqttIdentity(String mqttIdentity) {}
}
