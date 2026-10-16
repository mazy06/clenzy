package com.baitly.iot;

import java.util.UUID;

/**
 * Carries the credential fingerprint so rotation is checked again under the ingestion lock.
 * HTTP devices are identified by their bearer secret, MQTT devices by their certificate CN:
 * rotating one never invalidates the other, revocation blocks both.
 */
public record DeviceIdentity(UUID id, Credential credential, String fingerprint) {
    public enum Credential { HTTP_TOKEN, MQTT_CERTIFICATE }

    static DeviceIdentity http(UUID id, String tokenHash) { return new DeviceIdentity(id, Credential.HTTP_TOKEN, tokenHash); }
    static DeviceIdentity mqtt(UUID id, String mqttIdentity) { return new DeviceIdentity(id, Credential.MQTT_CERTIFICATE, mqttIdentity); }

    @Override public String toString() { return "Baitly device " + id; }
}
