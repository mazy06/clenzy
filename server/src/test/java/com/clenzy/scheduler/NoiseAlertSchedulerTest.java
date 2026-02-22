package com.clenzy.scheduler;

import com.clenzy.dto.noise.NoiseDataPointDto;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.NoiseAlertConfig;
import com.clenzy.model.NoiseDevice;
import com.clenzy.model.NoiseDevice.DeviceStatus;
import com.clenzy.repository.NoiseAlertConfigRepository;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.NoiseDeviceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link NoiseAlertScheduler}.
 * Validates noise polling, alert triggering, and error isolation.
 */
@ExtendWith(MockitoExtension.class)
class NoiseAlertSchedulerTest {

    @Mock
    private NoiseAlertConfigRepository configRepository;
    @Mock
    private NoiseDeviceRepository deviceRepository;
    @Mock
    private NoiseDeviceService deviceService;
    @Mock
    private NoiseAlertService alertService;

    private NoiseAlertScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new NoiseAlertScheduler(configRepository, deviceRepository, deviceService, alertService);
    }

    private NoiseAlertConfig createConfig(Long propertyId, Long orgId) {
        NoiseAlertConfig config = new NoiseAlertConfig();
        config.setPropertyId(propertyId);
        config.setOrganizationId(orgId);
        return config;
    }

    private NoiseDevice createDevice(Long id, String userId) {
        NoiseDevice device = new NoiseDevice();
        device.setId(id);
        device.setUserId(userId);
        device.setStatus(DeviceStatus.ACTIVE);
        return device;
    }

    @Nested
    @DisplayName("checkNoiseLevels")
    class CheckNoiseLevels {

        @Test
        void whenNoConfigs_thenDoesNothing() {
            when(configRepository.findAllEnabledWithTimeWindows()).thenReturn(List.of());

            scheduler.checkNoiseLevels();

            verifyNoInteractions(deviceRepository, deviceService, alertService);
        }

        @Test
        void whenConfigWithNoDevices_thenSkips() {
            NoiseAlertConfig config = createConfig(1L, 1L);
            when(configRepository.findAllEnabledWithTimeWindows()).thenReturn(List.of(config));
            when(deviceRepository.findByPropertyIdAndStatus(1L, DeviceStatus.ACTIVE)).thenReturn(List.of());

            scheduler.checkNoiseLevels();

            verifyNoInteractions(deviceService, alertService);
        }

        @Test
        void whenDeviceReturnsData_thenEvaluatesNoiseLevel() {
            NoiseAlertConfig config = createConfig(1L, 10L);
            NoiseDevice device = createDevice(100L, "user-1");

            when(configRepository.findAllEnabledWithTimeWindows()).thenReturn(List.of(config));
            when(deviceRepository.findByPropertyIdAndStatus(1L, DeviceStatus.ACTIVE)).thenReturn(List.of(device));

            NoiseDataPointDto dataPoint = new NoiseDataPointDto();
            dataPoint.setDecibels(85.0);
            when(deviceService.getNoiseData(eq("user-1"), eq(100L), anyString(), anyString()))
                    .thenReturn(List.of(dataPoint));

            scheduler.checkNoiseLevels();

            verify(alertService).evaluateNoiseLevel(10L, 1L, 100L, 85.0, NoiseAlert.AlertSource.SCHEDULER);
        }

        @Test
        void whenDeviceServiceThrows_thenContinuesWithNextDevice() {
            NoiseAlertConfig config = createConfig(1L, 10L);
            NoiseDevice device1 = createDevice(100L, "user-1");
            NoiseDevice device2 = createDevice(200L, "user-2");

            when(configRepository.findAllEnabledWithTimeWindows()).thenReturn(List.of(config));
            when(deviceRepository.findByPropertyIdAndStatus(1L, DeviceStatus.ACTIVE))
                    .thenReturn(List.of(device1, device2));

            when(deviceService.getNoiseData(eq("user-1"), eq(100L), anyString(), anyString()))
                    .thenThrow(new RuntimeException("API error"));

            NoiseDataPointDto dataPoint = new NoiseDataPointDto();
            dataPoint.setDecibels(70.0);
            when(deviceService.getNoiseData(eq("user-2"), eq(200L), anyString(), anyString()))
                    .thenReturn(List.of(dataPoint));

            scheduler.checkNoiseLevels();

            // Device 2 should still be evaluated
            verify(alertService).evaluateNoiseLevel(10L, 1L, 200L, 70.0, NoiseAlert.AlertSource.SCHEDULER);
        }

        @Test
        void whenDeviceReturnsEmptyData_thenSkips() {
            NoiseAlertConfig config = createConfig(1L, 10L);
            NoiseDevice device = createDevice(100L, "user-1");

            when(configRepository.findAllEnabledWithTimeWindows()).thenReturn(List.of(config));
            when(deviceRepository.findByPropertyIdAndStatus(1L, DeviceStatus.ACTIVE))
                    .thenReturn(List.of(device));
            when(deviceService.getNoiseData(eq("user-1"), eq(100L), anyString(), anyString()))
                    .thenReturn(List.of());

            scheduler.checkNoiseLevels();

            verifyNoInteractions(alertService);
        }

        @Test
        void whenConfigProcessingFails_thenContinuesWithNextConfig() {
            NoiseAlertConfig config1 = createConfig(1L, 10L);
            NoiseAlertConfig config2 = createConfig(2L, 20L);

            when(configRepository.findAllEnabledWithTimeWindows()).thenReturn(List.of(config1, config2));
            when(deviceRepository.findByPropertyIdAndStatus(1L, DeviceStatus.ACTIVE))
                    .thenThrow(new RuntimeException("DB error"));
            when(deviceRepository.findByPropertyIdAndStatus(2L, DeviceStatus.ACTIVE))
                    .thenReturn(List.of());

            scheduler.checkNoiseLevels();

            // Should try to process config2 despite config1 failure
            verify(deviceRepository).findByPropertyIdAndStatus(2L, DeviceStatus.ACTIVE);
        }
    }
}
