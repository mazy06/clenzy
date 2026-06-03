package com.clenzy.service;

import com.clenzy.dto.device.DeviceSummaryDto;
import com.clenzy.dto.device.ProviderStatusDto;
import com.clenzy.dto.keyexchange.KeyExchangePointDto;
import com.clenzy.dto.noise.NoiseDeviceDto;
import com.clenzy.dto.smartlock.SmartLockDeviceDto;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.repository.MinutConnectionRepository;
import com.clenzy.integration.nuki.model.NukiConnection;
import com.clenzy.integration.nuki.repository.NukiConnectionRepository;
import com.clenzy.integration.tuya.repository.TuyaConnectionRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("DeviceAggregationService")
class DeviceAggregationServiceTest {

    private static final String USER = "kc-user-1";

    @Mock private SmartLockService smartLockService;
    @Mock private NoiseDeviceService noiseDeviceService;
    @Mock private KeyExchangeService keyExchangeService;
    @Mock private MinutConnectionRepository minutConnectionRepository;
    @Mock private TuyaConnectionRepository tuyaConnectionRepository;
    @Mock private NukiConnectionRepository nukiConnectionRepository;
    @Mock private TenantContext tenantContext;

    private DeviceAggregationService service;

    @BeforeEach
    void setUp() {
        service = new DeviceAggregationService(smartLockService, noiseDeviceService, keyExchangeService,
                minutConnectionRepository, tuyaConnectionRepository, nukiConnectionRepository, tenantContext);
    }

    private SmartLockDeviceDto lock() {
        SmartLockDeviceDto d = new SmartLockDeviceDto();
        d.setId(1L);
        d.setName("Serrure entrée");
        d.setPropertyId(10L);
        d.setPropertyName("Villa Bleue");
        d.setRoomName("Entrée");
        d.setBrand("NUKI");
        d.setStatus("ACTIVE");
        d.setLockState("LOCKED");
        d.setBatteryLevel(80);
        return d;
    }

    private NoiseDeviceDto noise() {
        NoiseDeviceDto d = new NoiseDeviceDto();
        d.setId(2L);
        d.setName("Capteur salon");
        d.setPropertyId(10L);
        d.setPropertyName("Villa Bleue");
        d.setDeviceType("MINUT");
        d.setStatus("ACTIVE");
        return d;
    }

    private KeyExchangePointDto keybox() {
        KeyExchangePointDto d = new KeyExchangePointDto();
        d.setId(3L);
        d.setStoreName("Point KeyNest");
        d.setPropertyId(10L);
        d.setPropertyName("Villa Bleue");
        d.setProvider("KEYNEST");
        d.setStatus("ACTIVE");
        d.setActiveCodesCount(2);
        return d;
    }

    private void stubDevices() {
        when(smartLockService.getUserDevices(USER)).thenReturn(List.of(lock()));
        when(noiseDeviceService.getUserDevices(USER)).thenReturn(List.of(noise()));
        when(keyExchangeService.getPoints(USER)).thenReturn(List.of(keybox()));
    }

    @Test
    @DisplayName("getDevices — agrege les 3 types et derive le provider par type")
    void getDevices_mapsAllKinds() {
        stubDevices();

        Map<String, DeviceSummaryDto> byKind = service.getDevices(USER).stream()
                .collect(Collectors.toMap(DeviceSummaryDto::kind, Function.identity()));

        assertThat(byKind).containsOnlyKeys("lock", "noise", "keybox");

        DeviceSummaryDto lockDto = byKind.get("lock");
        assertThat(lockDto.provider()).isEqualTo("NUKI"); // <- brand
        assertThat(lockDto.lockState()).isEqualTo("LOCKED");
        assertThat(lockDto.batteryLevel()).isEqualTo(80);
        assertThat(lockDto.propertyName()).isEqualTo("Villa Bleue");

        assertThat(byKind.get("noise").provider()).isEqualTo("MINUT"); // <- deviceType
        assertThat(byKind.get("keybox").provider()).isEqualTo("KEYNEST"); // <- provider
        assertThat(byKind.get("keybox").activeCodesCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("getDevices — provider absent -> UNKNOWN")
    void getDevices_unknownProvider() {
        SmartLockDeviceDto noBrand = lock();
        noBrand.setBrand(null);
        when(smartLockService.getUserDevices(USER)).thenReturn(List.of(noBrand));
        when(noiseDeviceService.getUserDevices(USER)).thenReturn(List.of());
        when(keyExchangeService.getPoints(USER)).thenReturn(List.of());

        assertThat(service.getDevices(USER)).singleElement()
                .extracting(DeviceSummaryDto::provider).isEqualTo("UNKNOWN");
    }

    @Test
    @DisplayName("getProviderStatuses — connexion reelle Minut/Tuya/Nuki + comptes")
    void getProviderStatuses_realConnections() {
        stubDevices();

        MinutConnection minut = mock(MinutConnection.class);
        when(minut.isActive()).thenReturn(true);
        when(minutConnectionRepository.findByUserId(USER)).thenReturn(Optional.of(minut));
        when(tuyaConnectionRepository.findByUserId(USER)).thenReturn(Optional.empty());

        NukiConnection nuki = mock(NukiConnection.class);
        when(nuki.isActive()).thenReturn(true);
        lenient().when(tenantContext.getOrganizationId()).thenReturn(99L);
        when(nukiConnectionRepository.findByOrganizationId(99L)).thenReturn(Optional.of(nuki));

        Map<String, ProviderStatusDto> byProvider = service.getProviderStatuses(USER).stream()
                .collect(Collectors.toMap(ProviderStatusDto::provider, Function.identity()));

        assertThat(byProvider.get("MINUT").connected()).isTrue();
        assertThat(byProvider.get("MINUT").deviceCount()).isEqualTo(1);
        assertThat(byProvider.get("TUYA").connected()).isFalse();
        assertThat(byProvider.get("TUYA").deviceCount()).isZero();
        assertThat(byProvider.get("NUKI").connected()).isTrue();
        assertThat(byProvider.get("NUKI").deviceCount()).isEqualTo(1); // serrure NUKI
        // KeyNest : presence-based (1 point), pas de connexion org-level
        assertThat(byProvider.get("KEYNEST").connected()).isTrue();
        assertThat(byProvider.get("KEYNEST").deviceCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("getProviderStatuses — aucune connexion -> deconnecte, KeyNest absent")
    void getProviderStatuses_noConnections() {
        when(smartLockService.getUserDevices(USER)).thenReturn(List.of());
        when(noiseDeviceService.getUserDevices(USER)).thenReturn(List.of());
        when(keyExchangeService.getPoints(USER)).thenReturn(List.of());
        when(minutConnectionRepository.findByUserId(USER)).thenReturn(Optional.empty());
        when(tuyaConnectionRepository.findByUserId(USER)).thenReturn(Optional.empty());
        lenient().when(tenantContext.getOrganizationId()).thenReturn(99L);
        when(nukiConnectionRepository.findByOrganizationId(99L)).thenReturn(Optional.empty());

        Map<String, ProviderStatusDto> byProvider = service.getProviderStatuses(USER).stream()
                .collect(Collectors.toMap(ProviderStatusDto::provider, Function.identity()));

        assertThat(byProvider.get("MINUT").connected()).isFalse();
        assertThat(byProvider.get("NUKI").connected()).isFalse();
        // KeyNest sans objet -> pas de ligne (presence-based)
        assertThat(byProvider).doesNotContainKey("KEYNEST");
    }
}
