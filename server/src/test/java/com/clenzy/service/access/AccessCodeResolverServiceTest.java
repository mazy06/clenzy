package com.clenzy.service.access;

import com.clenzy.dto.keyexchange.KeyExchangeCodeDto;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.model.*;
import com.clenzy.model.KeyExchangePoint.PointStatus;
import com.clenzy.model.KeyExchangePoint.Provider;
import com.clenzy.model.SmartLockDevice.DeviceStatus;
import com.clenzy.repository.KeyExchangePointRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.service.KeyExchangeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccessCodeResolverServiceTest {

    @Mock private SmartLockDeviceRepository smartLockRepository;
    @Mock private KeyExchangePointRepository keyExchangePointRepository;
    @Mock private TuyaApiService tuyaApiService;
    @Mock private KeyExchangeService keyExchangeService;

    private AccessCodeResolverService service;

    private Property property;
    private Reservation reservation;
    private CheckInInstructions instructions;

    @BeforeEach
    void setUp() {
        service = new AccessCodeResolverService(
                smartLockRepository, keyExchangePointRepository,
                tuyaApiService, keyExchangeService
        );

        property = new Property();
        property.setId(10L);
        property.setName("Studio Test");

        reservation = new Reservation();
        reservation.setId(100L);
        reservation.setProperty(property);
        reservation.setGuestName("Jean Dupont");
        reservation.setCheckIn(LocalDate.of(2026, 4, 1));
        reservation.setCheckOut(LocalDate.of(2026, 4, 5));

        instructions = new CheckInInstructions();
        instructions.setAccessCode("1234");
    }

    // ─── Tier 1 : Smart Lock ────────────────────────────────

    @Test
    void whenSmartLockActive_thenGeneratesTuyaTempCode() {
        SmartLockDevice device = createSmartLock("tuya-device-123");

        when(smartLockRepository.findByPropertyIdAndStatus(10L, DeviceStatus.ACTIVE))
                .thenReturn(List.of(device));
        when(tuyaApiService.createTemporaryPassword(eq("tuya-device-123"), anyLong(), anyLong(), anyString()))
                .thenReturn(Map.of("password", "987654", "id", "pwd-001"));

        AccessCodeResult result = service.resolveForReservation(property, reservation, instructions);

        assertThat(result.method()).isEqualTo(AccessCodeResult.AccessMethod.SMART_LOCK);
        assertThat(result.templateVariables().get("accessCode")).isEqualTo("987654");
        assertThat(result.templateVariables().get("accessMethod")).isEqualTo("SMART_LOCK");

        verify(tuyaApiService).createTemporaryPassword(eq("tuya-device-123"), anyLong(), anyLong(), contains("Jean Dupont"));
    }

    @Test
    void whenSmartLockActiveButTuyaFails_thenFallsBackToStaticCode() {
        SmartLockDevice device = createSmartLock("tuya-device-123");

        when(smartLockRepository.findByPropertyIdAndStatus(10L, DeviceStatus.ACTIVE))
                .thenReturn(List.of(device));
        when(tuyaApiService.createTemporaryPassword(anyString(), anyLong(), anyLong(), anyString()))
                .thenThrow(new RuntimeException("Tuya circuit breaker open"));

        AccessCodeResult result = service.resolveForReservation(property, reservation, instructions);

        // Fallback vers le code statique
        assertThat(result.method()).isEqualTo(AccessCodeResult.AccessMethod.MANUAL);
        assertThat(result.templateVariables().get("accessCode")).isEqualTo("1234");
        assertThat(result.templateVariables().get("accessMethod")).isEqualTo("STATIC");
    }

    @Test
    void whenSmartLockActiveButNoExternalDeviceId_thenReturnsManual() {
        SmartLockDevice device = createSmartLock(null);

        when(smartLockRepository.findByPropertyIdAndStatus(10L, DeviceStatus.ACTIVE))
                .thenReturn(List.of(device));

        AccessCodeResult result = service.resolveForReservation(property, reservation, instructions);

        assertThat(result.method()).isEqualTo(AccessCodeResult.AccessMethod.MANUAL);
        assertThat(result.templateVariables()).isEmpty();

        verifyNoInteractions(tuyaApiService);
    }

    @Test
    void whenSmartLockActiveAndTuyaFailsAndNoStaticCode_thenReturnsEmptyManual() {
        SmartLockDevice device = createSmartLock("tuya-device-123");
        CheckInInstructions emptyInstructions = new CheckInInstructions();

        when(smartLockRepository.findByPropertyIdAndStatus(10L, DeviceStatus.ACTIVE))
                .thenReturn(List.of(device));
        when(tuyaApiService.createTemporaryPassword(anyString(), anyLong(), anyLong(), anyString()))
                .thenThrow(new RuntimeException("Tuya error"));

        AccessCodeResult result = service.resolveForReservation(property, reservation, emptyInstructions);

        assertThat(result.method()).isEqualTo(AccessCodeResult.AccessMethod.MANUAL);
        assertThat(result.templateVariables()).isEmpty();
    }

    // ─── Tier 2 : Key Exchange ──────────────────────────────

    @Test
    void whenNoSmartLockButKeyExchangeActive_thenGeneratesKeyExchangeCode() {
        KeyExchangePoint point = createKeyExchangePoint();

        when(smartLockRepository.findByPropertyIdAndStatus(10L, DeviceStatus.ACTIVE))
                .thenReturn(List.of());
        when(keyExchangePointRepository.findByPropertyIdAndStatus(10L, PointStatus.ACTIVE))
                .thenReturn(List.of(point));

        KeyExchangeCodeDto codeDto = new KeyExchangeCodeDto();
        codeDto.setCode("456789");
        when(keyExchangeService.generateCode(eq("system"), any()))
                .thenReturn(codeDto);

        AccessCodeResult result = service.resolveForReservation(property, reservation, instructions);

        assertThat(result.method()).isEqualTo(AccessCodeResult.AccessMethod.KEY_EXCHANGE);
        assertThat(result.templateVariables().get("accessCode")).isEqualTo("456789");
        assertThat(result.templateVariables().get("accessMethod")).isEqualTo("KEY_EXCHANGE");
        assertThat(result.templateVariables().get("keyExchangeStoreName")).isEqualTo("Tabac de la Gare");
        assertThat(result.templateVariables().get("keyExchangeStoreAddress")).isEqualTo("5 rue de la Gare, 75010 Paris");
        assertThat(result.templateVariables().get("keyExchangeStorePhone")).isEqualTo("+33 1 42 00 00 00");
        assertThat(result.templateVariables().get("keyExchangeStoreHours")).isEqualTo("Lun-Sam 8h-20h");
    }

    @Test
    void whenKeyExchangeGenerationFails_thenReturnsManual() {
        when(smartLockRepository.findByPropertyIdAndStatus(10L, DeviceStatus.ACTIVE))
                .thenReturn(List.of());
        when(keyExchangePointRepository.findByPropertyIdAndStatus(10L, PointStatus.ACTIVE))
                .thenReturn(List.of(createKeyExchangePoint()));
        when(keyExchangeService.generateCode(anyString(), any()))
                .thenThrow(new RuntimeException("Code generation failed"));

        AccessCodeResult result = service.resolveForReservation(property, reservation, instructions);

        assertThat(result.method()).isEqualTo(AccessCodeResult.AccessMethod.MANUAL);
    }

    // ─── Tier 3 : Manuel ────────────────────────────────────

    @Test
    void whenNoSmartLockAndNoKeyExchange_thenReturnsManual() {
        when(smartLockRepository.findByPropertyIdAndStatus(10L, DeviceStatus.ACTIVE))
                .thenReturn(List.of());
        when(keyExchangePointRepository.findByPropertyIdAndStatus(10L, PointStatus.ACTIVE))
                .thenReturn(List.of());

        AccessCodeResult result = service.resolveForReservation(property, reservation, instructions);

        assertThat(result.method()).isEqualTo(AccessCodeResult.AccessMethod.MANUAL);
        assertThat(result.templateVariables()).isEmpty();

        verifyNoInteractions(tuyaApiService);
        verifyNoInteractions(keyExchangeService);
    }

    // ─── Priorite ───────────────────────────────────────────

    @Test
    void whenSmartLockAndKeyExchangeBothConfigured_thenSmartLockTakesPriority() {
        SmartLockDevice device = createSmartLock("tuya-device-123");
        KeyExchangePoint point = createKeyExchangePoint();

        when(smartLockRepository.findByPropertyIdAndStatus(10L, DeviceStatus.ACTIVE))
                .thenReturn(List.of(device));
        when(tuyaApiService.createTemporaryPassword(eq("tuya-device-123"), anyLong(), anyLong(), anyString()))
                .thenReturn(Map.of("password", "111222"));

        AccessCodeResult result = service.resolveForReservation(property, reservation, instructions);

        assertThat(result.method()).isEqualTo(AccessCodeResult.AccessMethod.SMART_LOCK);
        assertThat(result.templateVariables().get("accessCode")).isEqualTo("111222");

        // Key exchange ne doit pas etre appele
        verifyNoInteractions(keyExchangePointRepository);
        verifyNoInteractions(keyExchangeService);
    }

    // ─── Helpers ────────────────────────────────────────────

    private SmartLockDevice createSmartLock(String externalDeviceId) {
        SmartLockDevice device = new SmartLockDevice();
        device.setId(1L);
        device.setPropertyId(10L);
        device.setExternalDeviceId(externalDeviceId);
        device.setName("Porte principale");
        device.setStatus(DeviceStatus.ACTIVE);
        return device;
    }

    private KeyExchangePoint createKeyExchangePoint() {
        KeyExchangePoint point = new KeyExchangePoint();
        point.setId(1L);
        point.setPropertyId(10L);
        point.setProvider(Provider.CLENZY_KEYVAULT);
        point.setStoreName("Tabac de la Gare");
        point.setStoreAddress("5 rue de la Gare, 75010 Paris");
        point.setStorePhone("+33 1 42 00 00 00");
        point.setStoreOpeningHours("Lun-Sam 8h-20h");
        point.setStatus(PointStatus.ACTIVE);
        return point;
    }
}
