package com.clenzy.service;

import com.clenzy.dto.noise.CreateNoiseDeviceDto;
import com.clenzy.dto.noise.NoiseChartDataDto;
import com.clenzy.dto.noise.NoiseDataPointDto;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
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
    private static final String USER_ID = "user-1";

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
        device.setUserId(USER_ID);
        return device;
    }

    private Property buildProperty(Long id, String name) {
        Property property = new Property();
        property.setId(id);
        property.setName(name);
        return property;
    }

    // ===== GET USER DEVICES =====

    @Nested
    @DisplayName("getUserDevices")
    class GetUserDevices {

        @Test
        @DisplayName("when devices exist then returns DTO list with property names")
        void whenDevicesExist_thenReturnsDtoList() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Capteur Salon", DeviceType.MINUT);
            when(noiseDeviceRepository.findByUserId(USER_ID)).thenReturn(List.of(device));
            Property property = buildProperty(1L, "Appart Paris");
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));

            // Act
            List<NoiseDeviceDto> result = service.getUserDevices(USER_ID);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("Capteur Salon");
            assertThat(result.get(0).getPropertyName()).isEqualTo("Appart Paris");
            assertThat(result.get(0).getDeviceType()).isEqualTo("MINUT");
            assertThat(result.get(0).getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        @DisplayName("when no devices then returns empty list")
        void whenNoDevices_thenReturnsEmpty() {
            // Arrange
            when(noiseDeviceRepository.findByUserId("user-2")).thenReturn(List.of());

            // Act
            List<NoiseDeviceDto> result = service.getUserDevices("user-2");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when multiple devices then returns all")
        void whenMultipleDevices_thenReturnsAll() {
            // Arrange
            NoiseDevice d1 = buildDevice(1L, "Capteur A", DeviceType.MINUT);
            NoiseDevice d2 = buildDevice(2L, "Capteur B", DeviceType.TUYA);
            when(noiseDeviceRepository.findByUserId(USER_ID)).thenReturn(List.of(d1, d2));
            Property property = buildProperty(1L, "Appart");
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));

            // Act
            List<NoiseDeviceDto> result = service.getUserDevices(USER_ID);

            // Assert
            assertThat(result).hasSize(2);
        }
    }

    // ===== CREATE DEVICE =====

    @Nested
    @DisplayName("createDevice")
    class CreateDevice {

        @Test
        @DisplayName("when property exists then creates device with correct fields")
        void whenPropertyExists_thenCreatesWithCorrectFields() {
            // Arrange
            Property property = buildProperty(1L, "Test Prop");
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(noiseDeviceRepository.save(any(NoiseDevice.class))).thenAnswer(inv -> {
                NoiseDevice d = inv.getArgument(0);
                d.setId(10L);
                return d;
            });

            CreateNoiseDeviceDto dto = new CreateNoiseDeviceDto();
            dto.setPropertyId(1L);
            dto.setDeviceType("MINUT");
            dto.setName("Capteur Chambre");
            dto.setRoomName("Salon");
            dto.setExternalDeviceId("ext-123");
            dto.setExternalHomeId("home-456");

            // Act
            NoiseDeviceDto result = service.createDevice(USER_ID, dto);

            // Assert
            assertThat(result.getName()).isEqualTo("Capteur Chambre");
            assertThat(result.getDeviceType()).isEqualTo("MINUT");

            ArgumentCaptor<NoiseDevice> captor = ArgumentCaptor.forClass(NoiseDevice.class);
            verify(noiseDeviceRepository).save(captor.capture());
            NoiseDevice saved = captor.getValue();
            assertThat(saved.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(saved.getUserId()).isEqualTo(USER_ID);
            assertThat(saved.getStatus()).isEqualTo(DeviceStatus.ACTIVE);
            assertThat(saved.getRoomName()).isEqualTo("Salon");
            assertThat(saved.getExternalDeviceId()).isEqualTo("ext-123");
            assertThat(saved.getExternalHomeId()).isEqualTo("home-456");
        }

        @Test
        @DisplayName("when TUYA device type then creates TUYA device")
        void whenTuyaType_thenCreatesTuyaDevice() {
            // Arrange
            Property property = buildProperty(1L, "Prop");
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));
            when(noiseDeviceRepository.save(any(NoiseDevice.class))).thenAnswer(inv -> {
                NoiseDevice d = inv.getArgument(0);
                d.setId(11L);
                return d;
            });

            CreateNoiseDeviceDto dto = new CreateNoiseDeviceDto();
            dto.setPropertyId(1L);
            dto.setDeviceType("tuya");
            dto.setName("Tuya Sensor");

            // Act
            NoiseDeviceDto result = service.createDevice(USER_ID, dto);

            // Assert
            assertThat(result.getDeviceType()).isEqualTo("TUYA");
        }

        @Test
        @DisplayName("when property not found then throws IllegalArgumentException")
        void whenPropertyNotFound_thenThrows() {
            // Arrange
            when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

            CreateNoiseDeviceDto dto = new CreateNoiseDeviceDto();
            dto.setPropertyId(99L);
            dto.setDeviceType("MINUT");
            dto.setName("Test");

            // Act & Assert
            assertThatThrownBy(() -> service.createDevice(USER_ID, dto))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }
    }

    // ===== DELETE DEVICE =====

    @Nested
    @DisplayName("deleteDevice")
    class DeleteDevice {

        @Test
        @DisplayName("when device exists and belongs to user then deletes")
        void whenDeviceExists_thenDeletes() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Test", DeviceType.MINUT);
            when(noiseDeviceRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(device));

            // Act
            service.deleteDevice(USER_ID, 1L);

            // Assert
            verify(noiseDeviceRepository).delete(device);
        }

        @Test
        @DisplayName("when device not found then throws IllegalArgumentException")
        void whenDeviceNotFound_thenThrows() {
            // Arrange
            when(noiseDeviceRepository.findByIdAndUserId(99L, USER_ID)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.deleteDevice(USER_ID, 99L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }
    }

    // ===== GET NOISE DATA =====

    @Nested
    @DisplayName("getNoiseData")
    class GetNoiseData {

        @Test
        @DisplayName("when device not found then throws IllegalArgumentException")
        void whenDeviceNotFound_thenThrows() {
            // Arrange
            when(noiseDeviceRepository.findByIdAndUserId(99L, USER_ID)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.getNoiseData(USER_ID, 99L, null, null))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("when no external device ID then returns empty list")
        void whenNoExternalId_thenReturnsEmpty() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Test", DeviceType.MINUT);
            device.setExternalDeviceId(null);
            when(noiseDeviceRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(device));

            // Act
            List<NoiseDataPointDto> result = service.getNoiseData(USER_ID, 1L, null, null);

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when empty external device ID then returns empty list")
        void whenEmptyExternalId_thenReturnsEmpty() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Test", DeviceType.MINUT);
            device.setExternalDeviceId("");
            when(noiseDeviceRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(device));

            // Act
            List<NoiseDataPointDto> result = service.getNoiseData(USER_ID, 1L, null, null);

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when MINUT device then calls MinutApiService and parses response")
        void whenMinutDevice_thenCallsMinutApi() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Minut Sensor", DeviceType.MINUT);
            device.setExternalDeviceId("ext-minut-1");
            when(noiseDeviceRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(device));

            Property property = buildProperty(1L, "Paris Apt");
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));

            Map<String, Object> point1 = Map.of("datetime", "2026-02-22T14:30:00Z", "value", 45.5);
            Map<String, Object> point2 = Map.of("datetime", "2026-02-22T15:00:00Z", "value", 52.0);
            Map<String, Object> response = Map.of("values", List.of(point1, point2));
            when(minutApiService.getSoundLevels(eq(USER_ID), eq("ext-minut-1"), any(), any(), eq(1800)))
                    .thenReturn(response);

            // Act
            List<NoiseDataPointDto> result = service.getNoiseData(USER_ID, 1L, "2026-02-22T00:00", "2026-02-22T23:59");

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result.get(0).getTime()).isEqualTo("14:30");
            assertThat(result.get(0).getDecibels()).isEqualTo(45.5);
            assertThat(result.get(1).getTime()).isEqualTo("15:00");
            assertThat(result.get(1).getDecibels()).isEqualTo(52.0);
        }

        @Test
        @DisplayName("when MINUT API returns null then returns empty list")
        void whenMinutReturnsNull_thenReturnsEmpty() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Minut Sensor", DeviceType.MINUT);
            device.setExternalDeviceId("ext-minut-1");
            when(noiseDeviceRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(device));
            lenient().when(propertyRepository.findById(1L)).thenReturn(Optional.of(buildProperty(1L, "Apt")));
            when(minutApiService.getSoundLevels(any(), any(), any(), any(), anyInt())).thenReturn(null);

            // Act
            List<NoiseDataPointDto> result = service.getNoiseData(USER_ID, 1L, "start", "end");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when TUYA device then calls TuyaApiService and parses noise_value logs")
        void whenTuyaDevice_thenCallsTuyaApi() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Tuya Sensor", DeviceType.TUYA);
            device.setExternalDeviceId("ext-tuya-1");
            when(noiseDeviceRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(device));

            Property property = buildProperty(1L, "Lyon Apt");
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));

            Map<String, Object> log1 = Map.of("code", "noise_value", "event_time", 1708614600000L, "value", 55000);
            Map<String, Object> log2 = Map.of("code", "temperature", "event_time", 1708614600000L, "value", 22000);
            Map<String, Object> response = Map.of("logs", List.of(log1, log2));
            when(tuyaApiService.getDeviceLogs(eq("ext-tuya-1"), anyLong(), anyLong()))
                    .thenReturn(response);

            // Act
            List<NoiseDataPointDto> result = service.getNoiseData(USER_ID, 1L, "start", "end");

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getDecibels()).isEqualTo(55.0);
        }

        @Test
        @DisplayName("when TUYA API returns null then returns empty list")
        void whenTuyaReturnsNull_thenReturnsEmpty() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Tuya Sensor", DeviceType.TUYA);
            device.setExternalDeviceId("ext-tuya-1");
            when(noiseDeviceRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(device));
            when(tuyaApiService.getDeviceLogs(any(), anyLong(), anyLong())).thenReturn(null);

            // Act
            List<NoiseDataPointDto> result = service.getNoiseData(USER_ID, 1L, "start", "end");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("when API throws exception then returns empty list")
        void whenApiThrows_thenReturnsEmpty() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Sensor", DeviceType.MINUT);
            device.setExternalDeviceId("ext-1");
            when(noiseDeviceRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(device));
            lenient().when(propertyRepository.findById(1L)).thenReturn(Optional.of(buildProperty(1L, "Apt")));
            when(minutApiService.getSoundLevels(any(), any(), any(), any(), anyInt()))
                    .thenThrow(new RuntimeException("API error"));

            // Act
            List<NoiseDataPointDto> result = service.getNoiseData(USER_ID, 1L, "start", "end");

            // Assert
            assertThat(result).isEmpty();
        }
    }

    // ===== GET ALL NOISE DATA =====

    @Nested
    @DisplayName("getAllNoiseData")
    class GetAllNoiseData {

        @Test
        @DisplayName("when no active devices then returns empty chart data")
        void whenNoActiveDevices_thenReturnsEmptyChartData() {
            // Arrange
            when(noiseDeviceRepository.findByUserIdAndStatus(USER_ID, DeviceStatus.ACTIVE))
                    .thenReturn(Collections.emptyList());

            // Act
            NoiseChartDataDto result = service.getAllNoiseData(USER_ID, "start", "end");

            // Assert
            assertThat(result.getDevices()).isEmpty();
            assertThat(result.getChartData()).isEmpty();
        }

        @Test
        @DisplayName("when active devices with data then returns aggregated summaries")
        void whenActiveDevicesWithData_thenReturnsSummaries() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Sensor 1", DeviceType.MINUT);
            device.setExternalDeviceId("ext-1");
            when(noiseDeviceRepository.findByUserIdAndStatus(USER_ID, DeviceStatus.ACTIVE))
                    .thenReturn(List.of(device));

            Property property = buildProperty(1L, "Paris Apt");
            when(propertyRepository.findById(1L)).thenReturn(Optional.of(property));

            // Mock getNoiseData -> fetchMinutNoiseData
            Map<String, Object> point1 = Map.of("datetime", "2026-02-22T10:00:00Z", "value", 40.0);
            Map<String, Object> point2 = Map.of("datetime", "2026-02-22T10:30:00Z", "value", 60.0);
            Map<String, Object> response = Map.of("values", List.of(point1, point2));
            when(minutApiService.getSoundLevels(any(), any(), any(), any(), anyInt()))
                    .thenReturn(response);

            // Also need to stub findByIdAndUserId for the getNoiseData call
            when(noiseDeviceRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(device));

            // Act
            NoiseChartDataDto result = service.getAllNoiseData(USER_ID, "start", "end");

            // Assert
            assertThat(result.getDevices()).hasSize(1);
            NoiseChartDataDto.DeviceSummary summary = result.getDevices().get(0);
            assertThat(summary.getCurrentLevel()).isEqualTo(60.0);
            assertThat(summary.getAverageLevel()).isEqualTo(50.0);
            assertThat(summary.getMaxLevel()).isEqualTo(60.0);

            assertThat(result.getChartData()).hasSize(2);
        }

        @Test
        @DisplayName("when device returns empty data then skips in summary")
        void whenDeviceReturnsEmptyData_thenSkipsInSummary() {
            // Arrange
            NoiseDevice device = buildDevice(1L, "Sensor 1", DeviceType.MINUT);
            device.setExternalDeviceId(null); // will return empty
            when(noiseDeviceRepository.findByUserIdAndStatus(USER_ID, DeviceStatus.ACTIVE))
                    .thenReturn(List.of(device));
            when(noiseDeviceRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(device));

            // Act
            NoiseChartDataDto result = service.getAllNoiseData(USER_ID, "start", "end");

            // Assert
            assertThat(result.getDevices()).isEmpty();
            assertThat(result.getChartData()).isEmpty();
        }
    }
}
