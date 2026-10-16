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
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.function.Supplier;

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
    @Mock
    private SupervisionActivityService supervisionActivityService;
    @Mock
    private SupervisionSuggestionService supervisionSuggestionService;

    @Mock
    private TenantScopedExecutor tenantScopedExecutor;

    private final TenantContext tenantContext = new TenantContext();
    private NoiseAlertScheduler scheduler;

    @BeforeEach
    void setUp() {
        // Same contract as the real executor: org on the ThreadLocal during the action, cleared after.
        lenient().when(tenantScopedExecutor.callAsOrganization(any(), any())).thenAnswer(invocation -> {
            Long orgId = invocation.getArgument(0);
            if (orgId == null) throw new IllegalArgumentException("organizationId est requis");
            tenantContext.setOrganizationId(orgId);
            try {
                return invocation.<Supplier<?>>getArgument(1).get();
            } finally {
                tenantContext.clear();
            }
        });
        scheduler = new NoiseAlertScheduler(configRepository, deviceRepository, deviceService, alertService,
                supervisionActivityService, supervisionSuggestionService, tenantScopedExecutor);
    }

    @AfterEach
    void clearTenant() {
        tenantContext.clear();
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
        device.setOrganizationId(10L);
        return device;
    }

    @Nested
    @DisplayName("checkNoiseLevels")
    class CheckNoiseLevels {

        @Test
        void whenDeviceIsSimulated_thenNeverEvaluatesAlertsOrNotifiesGuests() {
            NoiseAlertConfig config = createConfig(1L, 10L);
            NoiseDevice device = createDevice(100L, "user-1");
            device.setSimulation(true);
            when(configRepository.findAllEnabledWithTimeWindows()).thenReturn(List.of(config));
            when(deviceRepository.findByPropertyIdAndStatus(1L, DeviceStatus.ACTIVE)).thenReturn(List.of(device));
            scheduler.checkNoiseLevels();
            verifyNoInteractions(deviceService, alertService, supervisionActivityService, supervisionSuggestionService);
        }

        @Test
        void whenReadingDevice_thenRunsInConfigOrganizationSoTheFailClosedGuardAccepts() {
            NoiseAlertConfig config = createConfig(1L, 10L);
            NoiseDevice device = createDevice(100L, "user-1");
            var guard = new OrganizationAccessGuard(tenantContext);
            when(configRepository.findAllEnabledWithTimeWindows()).thenReturn(List.of(config));
            when(deviceRepository.findByPropertyIdAndStatus(1L, DeviceStatus.ACTIVE)).thenReturn(List.of(device));
            when(deviceService.getNoiseData(eq("user-1"), eq(100L), anyString(), anyString())).thenAnswer(invocation -> {
                guard.requireSameOrganization(device.getOrganizationId(), "Capteur hors organisation");
                return List.of(new NoiseDataPointDto("2026-10-16T12:00:00Z", 80.0, "Salon"));
            });

            scheduler.checkNoiseLevels();

            verify(alertService).evaluateNoiseLevel(eq(10L), eq(1L), eq(100L), eq(80.0), any());
        }

        @Test
        void whenDeviceBelongsToAnotherOrganization_thenNeverReadsIt() {
            NoiseAlertConfig config = createConfig(1L, 10L);
            NoiseDevice foreign = createDevice(100L, "user-1");
            foreign.setOrganizationId(99L);
            when(configRepository.findAllEnabledWithTimeWindows()).thenReturn(List.of(config));
            when(deviceRepository.findByPropertyIdAndStatus(1L, DeviceStatus.ACTIVE)).thenReturn(List.of(foreign));

            scheduler.checkNoiseLevels();

            verifyNoInteractions(deviceService, alertService);
        }

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
