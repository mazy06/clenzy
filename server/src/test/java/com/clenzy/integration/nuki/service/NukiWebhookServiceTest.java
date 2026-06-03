package com.clenzy.integration.nuki.service;

import com.clenzy.model.SmartLockDevice;
import com.clenzy.model.SmartLockDevice.LockState;
import com.clenzy.repository.SmartLockDeviceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("NukiWebhookService")
class NukiWebhookServiceTest {

    @Mock
    private SmartLockDeviceRepository deviceRepository;

    @InjectMocks
    private NukiWebhookService service;

    private SmartLockDevice deviceWith(LockState state, Integer battery) {
        SmartLockDevice d = new SmartLockDevice();
        d.setId(1L);
        d.setExternalDeviceId("12345");
        d.setLockState(state);
        d.setBatteryLevel(battery);
        return d;
    }

    private Map<String, Object> payload(Object nukiId, Object state, Object battery) {
        Map<String, Object> p = new LinkedHashMap<>();
        if (nukiId != null) p.put("nukiId", nukiId);
        if (state != null) p.put("state", state);
        if (battery != null) p.put("batteryCharge", battery);
        return p;
    }

    @Test
    @DisplayName("state=1 -> LOCKED + batterie mis a jour, save appele")
    void appliesLockedAndBattery() {
        SmartLockDevice device = deviceWith(LockState.UNKNOWN, 50);
        when(deviceRepository.findByExternalDeviceId("12345")).thenReturn(Optional.of(device));

        boolean result = service.applyBridgeEvent(payload(12345, 1, 87));

        assertThat(result).isTrue();
        assertThat(device.getLockState()).isEqualTo(LockState.LOCKED);
        assertThat(device.getBatteryLevel()).isEqualTo(87);
        verify(deviceRepository).save(device);
    }

    @Test
    @DisplayName("state=3 -> UNLOCKED")
    void appliesUnlocked() {
        SmartLockDevice device = deviceWith(LockState.LOCKED, 90);
        when(deviceRepository.findByExternalDeviceId("12345")).thenReturn(Optional.of(device));

        service.applyBridgeEvent(payload(12345, 3, null));

        assertThat(device.getLockState()).isEqualTo(LockState.UNLOCKED);
    }

    @Test
    @DisplayName("etat transitoire (state=2) sans changement de batterie -> rien ne change, pas de save")
    void transientStateUnchanged() {
        SmartLockDevice device = deviceWith(LockState.LOCKED, 90);
        when(deviceRepository.findByExternalDeviceId("12345")).thenReturn(Optional.of(device));

        service.applyBridgeEvent(payload(12345, 2, 90));

        assertThat(device.getLockState()).isEqualTo(LockState.LOCKED);
        verify(deviceRepository, never()).save(any());
    }

    @Test
    @DisplayName("serrure inconnue -> false, aucun save")
    void unknownDevice() {
        when(deviceRepository.findByExternalDeviceId("999")).thenReturn(Optional.empty());

        boolean result = service.applyBridgeEvent(payload(999, 1, 50));

        assertThat(result).isFalse();
        verify(deviceRepository, never()).save(any());
    }

    @Test
    @DisplayName("nukiId absent -> false, repository non interroge")
    void missingNukiId() {
        boolean result = service.applyBridgeEvent(payload(null, 1, 50));

        assertThat(result).isFalse();
        verify(deviceRepository, never()).findByExternalDeviceId(anyString());
    }
}
