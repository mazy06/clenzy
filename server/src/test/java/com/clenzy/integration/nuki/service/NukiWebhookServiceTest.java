package com.clenzy.integration.nuki.service;

import com.clenzy.integration.nuki.model.NukiConnection;
import com.clenzy.integration.nuki.model.NukiConnection.NukiConnectionStatus;
import com.clenzy.integration.nuki.repository.NukiConnectionRepository;
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
import java.util.List;
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

    @Mock
    private NukiConnectionRepository connectionRepository;

    @InjectMocks
    private NukiWebhookService service;

    private static final Long ORG_ID = 1L;

    private SmartLockDevice deviceWith(LockState state, Integer battery) {
        SmartLockDevice d = new SmartLockDevice();
        d.setId(1L);
        d.setOrganizationId(ORG_ID);
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

    private NukiConnection connection(String secret) {
        NukiConnection c = new NukiConnection();
        c.setOrganizationId(ORG_ID);
        c.setWebhookSecret(secret);
        c.setStatus(NukiConnectionStatus.ACTIVE);
        return c;
    }

    // ─── resolveConnectionByToken (I2-IOT-01) ────────────────────────────────

    @Test
    @DisplayName("resolveConnectionByToken — token null/blank -> null (rejet)")
    void resolveToken_blank_returnsNull() {
        assertThat(service.resolveConnectionByToken(null)).isNull();
        assertThat(service.resolveConnectionByToken("  ")).isNull();
        verify(connectionRepository, never()).findAllByStatus(any());
    }

    @Test
    @DisplayName("resolveConnectionByToken — token connu -> connexion correspondante")
    void resolveToken_match_returnsConnection() {
        NukiConnection conn = connection("good-secret");
        when(connectionRepository.findAllByStatus(NukiConnectionStatus.ACTIVE))
                .thenReturn(List.of(connection("other"), conn));

        assertThat(service.resolveConnectionByToken("good-secret")).isSameAs(conn);
    }

    @Test
    @DisplayName("resolveConnectionByToken — token inconnu -> null")
    void resolveToken_noMatch_returnsNull() {
        when(connectionRepository.findAllByStatus(NukiConnectionStatus.ACTIVE))
                .thenReturn(List.of(connection("a"), connection("b")));

        assertThat(service.resolveConnectionByToken("zzz")).isNull();
    }

    // ─── applyBridgeEvent (org scope) ────────────────────────────────────────

    @Test
    @DisplayName("state=1 -> LOCKED + batterie mis a jour, save appele")
    void appliesLockedAndBattery() {
        SmartLockDevice device = deviceWith(LockState.UNKNOWN, 50);
        when(deviceRepository.findByExternalDeviceId("12345")).thenReturn(Optional.of(device));

        boolean result = service.applyBridgeEvent(payload(12345, 1, 87), ORG_ID);

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

        service.applyBridgeEvent(payload(12345, 3, null), ORG_ID);

        assertThat(device.getLockState()).isEqualTo(LockState.UNLOCKED);
    }

    @Test
    @DisplayName("etat transitoire (state=2) sans changement de batterie -> rien ne change, pas de save")
    void transientStateUnchanged() {
        SmartLockDevice device = deviceWith(LockState.LOCKED, 90);
        when(deviceRepository.findByExternalDeviceId("12345")).thenReturn(Optional.of(device));

        service.applyBridgeEvent(payload(12345, 2, 90), ORG_ID);

        assertThat(device.getLockState()).isEqualTo(LockState.LOCKED);
        verify(deviceRepository, never()).save(any());
    }

    @Test
    @DisplayName("serrure inconnue -> false, aucun save")
    void unknownDevice() {
        when(deviceRepository.findByExternalDeviceId("999")).thenReturn(Optional.empty());

        boolean result = service.applyBridgeEvent(payload(999, 1, 50), ORG_ID);

        assertThat(result).isFalse();
        verify(deviceRepository, never()).save(any());
    }

    @Test
    @DisplayName("nukiId absent -> false, repository non interroge")
    void missingNukiId() {
        boolean result = service.applyBridgeEvent(payload(null, 1, 50), ORG_ID);

        assertThat(result).isFalse();
        verify(deviceRepository, never()).findByExternalDeviceId(anyString());
    }

    @Test
    @DisplayName("I2-IOT-01 — serrure d'une autre org -> false, aucun save (ownership)")
    void crossOrgDevice_refused() {
        SmartLockDevice device = deviceWith(LockState.UNKNOWN, 50);
        device.setOrganizationId(999L); // org differente de celle du secret
        when(deviceRepository.findByExternalDeviceId("12345")).thenReturn(Optional.of(device));

        boolean result = service.applyBridgeEvent(payload(12345, 1, 87), ORG_ID);

        assertThat(result).isFalse();
        verify(deviceRepository, never()).save(any());
    }
}
