package com.clenzy.service;

import com.clenzy.dto.smartlock.CreateSmartLockDeviceDto;
import com.clenzy.dto.smartlock.SmartLockDeviceDto;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.integration.tuya.service.TuyaDeviceClaimService;
import com.clenzy.model.Property;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.model.SmartLockDevice.DeviceStatus;
import com.clenzy.model.SmartLockDevice.LockState;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SmartLockServiceTest {

    @Mock private SmartLockDeviceRepository smartLockRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private TuyaApiService tuyaApiService;
    @Mock private TenantContext tenantContext;
    @Mock private TuyaDeviceClaimService claimService;

    private SmartLockService service;

    @BeforeEach
    void setUp() {
        service = new SmartLockService(smartLockRepository, propertyRepository, tuyaApiService, tenantContext, claimService);
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
    }

    private SmartLockDevice buildDevice(Long id, String externalDeviceId) {
        SmartLockDevice device = new SmartLockDevice();
        try {
            var f = SmartLockDevice.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(device, id);
        } catch (Exception ignore) {}
        device.setOrganizationId(1L);
        device.setUserId("kc-1");
        device.setName("Front Door");
        device.setPropertyId(10L);
        device.setExternalDeviceId(externalDeviceId);
        device.setStatus(DeviceStatus.ACTIVE);
        device.setLockState(LockState.UNKNOWN);
        return device;
    }

    @Nested
    @DisplayName("getUserDevices")
    class GetUserDevices {

        @Test
        void whenDevicesExist_thenReturnsDtos() {
            SmartLockDevice device = buildDevice(1L, "tuya-1");
            Property property = new Property();
            property.setName("Apt 1");
            when(smartLockRepository.findByStatus(DeviceStatus.ACTIVE)).thenReturn(List.of(device));
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            List<SmartLockDeviceDto> result = service.getUserDevices("kc-1");

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("Front Door");
            assertThat(result.get(0).getPropertyName()).isEqualTo("Apt 1");
        }

        @Test
        void whenNoDevices_thenEmptyList() {
            when(smartLockRepository.findByStatus(DeviceStatus.ACTIVE)).thenReturn(List.of());

            assertThat(service.getUserDevices("kc-1")).isEmpty();
        }
    }

    @Nested
    @DisplayName("createDevice")
    class CreateDevice {

        @Test
        void whenPropertyExists_thenSavesAndReturnsDto() {
            CreateSmartLockDeviceDto dto = new CreateSmartLockDeviceDto();
            dto.setName("New Lock");
            dto.setPropertyId(10L);
            dto.setRoomName("Bedroom");
            dto.setExternalDeviceId("tuya-99");

            Property property = new Property();
            property.setName("Apt X");
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
            when(smartLockRepository.save(any(SmartLockDevice.class))).thenAnswer(inv -> {
                SmartLockDevice device = inv.getArgument(0);
                try {
                    var f = SmartLockDevice.class.getDeclaredField("id");
                    f.setAccessible(true);
                    f.set(device, 5L);
                } catch (Exception ignore) {}
                return device;
            });

            SmartLockDeviceDto result = service.createDevice("kc-1", dto);

            assertThat(result.getName()).isEqualTo("New Lock");
            assertThat(result.getExternalDeviceId()).isEqualTo("tuya-99");

            ArgumentCaptor<SmartLockDevice> captor = ArgumentCaptor.forClass(SmartLockDevice.class);
            verify(smartLockRepository).save(captor.capture());
            assertThat(captor.getValue().getUserId()).isEqualTo("kc-1");
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(1L);
        }

        @Test
        void whenPropertyNotFound_thenThrows() {
            CreateSmartLockDeviceDto dto = new CreateSmartLockDeviceDto();
            dto.setName("X");
            dto.setPropertyId(999L);
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createDevice("kc-1", dto))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("deleteDevice")
    class DeleteDevice {

        @Test
        void whenExists_thenDeletes() {
            SmartLockDevice device = buildDevice(1L, "tuya-1");
            when(smartLockRepository.findById(1L)).thenReturn(Optional.of(device));

            service.deleteDevice("kc-1", 1L);

            verify(smartLockRepository).delete(device);
        }

        @Test
        void whenNotFound_thenThrows() {
            when(smartLockRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteDevice("kc-1", 99L))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("getLockStatus")
    class GetLockStatus {

        @Test
        void whenNoExternalDeviceId_thenReturnsOffline() {
            SmartLockDevice device = buildDevice(1L, null);
            when(smartLockRepository.findById(1L)).thenReturn(Optional.of(device));

            Map<String, Object> result = service.getLockStatus("kc-1", 1L);

            assertThat(result).containsEntry("online", false).containsEntry("locked", false);
        }

        @Test
        void whenTuyaReturnsLocked_thenUpdatesAndReturnsLocked() {
            SmartLockDevice device = buildDevice(1L, "tuya-1");
            when(smartLockRepository.findById(1L)).thenReturn(Optional.of(device));
            when(smartLockRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> tuyaStatus = Map.of(
                    "result", List.of(
                            Map.of("code", "locked", "value", true),
                            Map.of("code", "battery_state", "value", 80)
                    )
            );
            when(tuyaApiService.getDeviceStatus("tuya-1")).thenReturn(tuyaStatus);
            // Connectivite reelle : getLockStatus lit le flag "online" via getDeviceInfo.
            when(tuyaApiService.getDeviceInfo("tuya-1")).thenReturn(Map.of("online", true));

            Map<String, Object> result = service.getLockStatus("kc-1", 1L);

            assertThat(result).containsEntry("locked", true)
                    .containsEntry("batteryLevel", 80)
                    .containsEntry("online", true);
            assertThat(device.getLockState()).isEqualTo(LockState.LOCKED);
        }

        @Test
        void whenTuyaThrows_thenReturnsFallbackOffline() {
            SmartLockDevice device = buildDevice(1L, "tuya-1");
            device.setLockState(LockState.LOCKED);
            device.setBatteryLevel(50);
            when(smartLockRepository.findById(1L)).thenReturn(Optional.of(device));
            when(tuyaApiService.getDeviceStatus("tuya-1")).thenThrow(new RuntimeException("Tuya down"));

            Map<String, Object> result = service.getLockStatus("kc-1", 1L);

            assertThat(result).containsEntry("online", false)
                    .containsEntry("locked", true)
                    .containsEntry("batteryLevel", 50);
        }

        @Test
        void whenDeviceNotFound_thenThrows() {
            when(smartLockRepository.findById(99L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.getLockStatus("kc-1", 99L))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("sendLockCommand")
    class SendLockCommand {

        @Test
        void whenLock_thenSendsCommandAndUpdates() {
            SmartLockDevice device = buildDevice(1L, "tuya-1");
            when(smartLockRepository.findById(1L)).thenReturn(Optional.of(device));
            when(smartLockRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.sendLockCommand("kc-1", 1L, true);

            verify(tuyaApiService).sendCommand(eq("tuya-1"), anyList());
            assertThat(device.getLockState()).isEqualTo(LockState.LOCKED);
        }

        @Test
        void whenUnlock_thenSendsCommandWithFalse() {
            SmartLockDevice device = buildDevice(1L, "tuya-1");
            when(smartLockRepository.findById(1L)).thenReturn(Optional.of(device));
            when(smartLockRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.sendLockCommand("kc-1", 1L, false);

            assertThat(device.getLockState()).isEqualTo(LockState.UNLOCKED);
        }

        @Test
        void whenNoExternalDeviceId_thenThrows() {
            SmartLockDevice device = buildDevice(1L, null);
            when(smartLockRepository.findById(1L)).thenReturn(Optional.of(device));

            assertThatThrownBy(() -> service.sendLockCommand("kc-1", 1L, true))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenDeviceNotFound_thenThrows() {
            when(smartLockRepository.findById(99L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.sendLockCommand("kc-1", 99L, true))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // Helper to avoid full import
    private static <T> T eq(T value) { return org.mockito.ArgumentMatchers.eq(value); }
}
