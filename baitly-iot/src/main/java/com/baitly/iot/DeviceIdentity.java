package com.baitly.iot;

import java.util.UUID;

/** Carries the credential fingerprint so rotation is checked again under the ingestion lock. */
public record DeviceIdentity(UUID id, String tokenHash) {
    @Override public String toString() { return "Baitly device " + id; }
}
