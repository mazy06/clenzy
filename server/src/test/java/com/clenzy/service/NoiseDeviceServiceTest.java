package com.clenzy.service;

import com.clenzy.dto.noise.CreateNoiseDeviceDto;
import com.clenzy.dto.noise.NoiseDeviceDto;
import com.clenzy.integration.minut.service.MinutApiService;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.model.NoiseDevice;
import com.clenzy.model.NoiseDevice.DeviceStatus;
import com.clenzy.model.NoiseDevice.DeviceType;
import com.clenzy.model.Property;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NoiseDeviceServiceTest {

    @Mock private NoiseDeviceRepository noiseDeviceRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private MinutApiService minutApiService;
    @Mock private TuyaApiService tuyaApiService;

    private TenantContext tenantContext;
    private NoiseDeviceService service;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new NoiseDeviceService(noiseDeviceRepository, propertyRepository,
                minutApiService, tuyaApiService, tenantContext);
    }

    private NoiseDevice buildDevice(Long id, String name, DeviceType type) {
        NoiseDevice device = new NoiseDevice();
        device.setId(id);
        device.setName(name);
        device.setDeviceType(type);
        device.setPropertyId(1L);
        device.setStatus(DeviceStatus.ACTIVE);
        device.setUserId("user-1");
        return device;
    }

    // ===== GET USER DEVICES =====

    @Nested
    class GetUserDevices {

        @Test
        void whenDevicesExist_thenReturnsDtoList() {
            NoiseDevice device = buildDevice(1L, "Capteur Salon", DeviceType.MINUT);
            when(noiseDeviceRepository.findByUserId("user-1")).thenReturn(List.of(device));
            Property property = new Property();
            property.setName("Appart Paris");
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));

            List<NoiseDeviceDto> result = service.getUserDevices("user-1");

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("Capteur Salon");
            assertThat(result.get(0).getPropertyName()).isEqualTo("Appart Paris");
        }

        @Test
        void whenNoDevices_thenReturnsEmpty() {
            when(noiseDeviceRepository.findByUserId("user-2")).thenReturn(List.of());

            List<NoiseDeviceDto> result = service.getUserDevices("user-2");

            assertThat(result).isEmpty();
        }
    }

    // ===== CREATE DEVICE =====

    @Nested
    class CreateDevice {

        @Test
        void whenPropertyExists_thenCreates() {
            Property property = new Property();
            property.setId(1L);
            property.setName("Test");
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(noiseDeviceRepository.save(any(NoiseDevice.class))).thenAnswer(inv -> {
                NoiseDevice d = inv.getArgument(0);
                d.setId(10L);
                return d;
            });
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));

            CreateNoiseDeviceDto dto = new CreateNoiseDeviceDto();
            dto.setPropertyId(1L);
            dto.setDeviceType("MINUT");
            dto.setName("Capteur Chambre");
            dto.setExternalDeviceId("ext-123");

            NoiseDeviceDto result = service.createDevice("user-1", dto);

            assertThat(result.getName()).isEqualTo("Capteur Chambre");
            assertThat(result.getDeviceType()).isEqualTo("MINUT");

            ArgumentCaptor<NoiseDevice> captor = ArgumentCaptor.forClass(NoiseDevice.class);
            verify(noiseDeviceRepository).save(captor.capture());
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }

        @Test
        void whenPropertyNotFound_thenThrows() {
            when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

            CreateNoiseDeviceDto dto = new CreateNoiseDeviceDto();
            dto.setPropertyId(99L);
            dto.setDeviceType("MINUT");
            dto.setName("Test");

            assertThatThrownBy(() -> service.createDevice("user-1", dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }
    }

    // ===== DELETE DEVICE =====

    @Nested
    class DeleteDevice {

        @Test
        void whenDeviceExists_thenDeletes() {
            NoiseDevice device = buildDevice(1L, "Test", DeviceType.MINUT);
            when(noiseDeviceRepository.findByIdAndUserId(1L, "user-1")).thenReturn(Optional.of(device));

            service.deleteDevice("user-1", 1L);

            verify(noiseDeviceRepository).delete(device);
        }

        @Test
        void whenDeviceNotFound_thenThrows() {
            when(noiseDeviceRepository.findByIdAndUserId(99L, "user-1")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteDevice("user-1", 99L))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ===== GET NOISE DATA =====

    @Nested
    class GetNoiseData {

        @Test
        void whenDeviceNotFound_thenThrows() {
            when(noiseDeviceRepository.findByIdAndUserId(99L, "user-1")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getNoiseData("user-1", 99L, null, null))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenNoExternalId_thenReturnsEmpty() {
            NoiseDevice device = buildDevice(1L, "Test", DeviceType.MINUT);
            device.setExternalDeviceId(null);
            when(noiseDeviceRepository.findByIdAndUserId(1L, "user-1")).thenReturn(Optional.of(device));

            var result = service.getNoiseData("user-1", 1L, null, null);

            assertThat(result).isEmpty();
        }
    }
}
