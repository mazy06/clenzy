package com.clenzy.service;

import com.clenzy.dto.environment.CreateEnvironmentSensorDto;
import com.clenzy.dto.environment.EnvironmentSensorDto;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.integration.tuya.service.TuyaDeviceClaimService;
import com.clenzy.model.EnvironmentSensor;
import com.clenzy.model.EnvironmentSensor.SensorStatus;
import com.clenzy.model.EnvironmentSensor.SensorType;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.repository.EnvironmentSensorRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnvironmentSensorServiceTest {

    @Mock EnvironmentSensorRepository sensorRepository;
    @Mock PropertyRepository propertyRepository;
    @Mock TuyaApiService tuyaApiService;
    @Mock TenantContext tenantContext;
    @Mock TuyaDeviceClaimService claimService;
    @Mock NotificationService notificationService;

    EnvironmentSensorService service;

    @BeforeEach
    void setUp() {
        service = new EnvironmentSensorService(sensorRepository, propertyRepository,
                tuyaApiService, tenantContext, claimService, notificationService);
    }

    private EnvironmentSensor buildSensor(SensorType type, String externalId) {
        EnvironmentSensor s = new EnvironmentSensor();
        s.setId(1L);
        s.setName("Capteur");
        s.setPropertyId(10L);
        s.setSensorType(type);
        s.setBrand("TUYA");
        s.setExternalDeviceId(externalId);
        s.setStatus(SensorStatus.ACTIVE);
        s.setOrganizationId(1L);
        return s;
    }

    private Map<String, Object> tuyaStatus(Map<String, Object>... dps) {
        return Map.of("result", List.of(dps));
    }

    @Nested
    @DisplayName("createSensor")
    class CreateSensor {

        @Test
        void whenValid_thenClaimsTuyaAndSaves() {
            Property property = new Property();
            property.setId(10L);
            property.setName("Villa");
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(sensorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            EnvironmentSensorDto dto = service.createSensor("kc-1",
                    new CreateEnvironmentSensorDto("Détecteur salon", 10L, "Salon", "SMOKE", "TUYA", "tuya-1"));

            assertThat(dto.sensorType()).isEqualTo("SMOKE");
            verify(claimService).claim("tuya-1", "environment_sensor");
            verify(sensorRepository).save(any());
        }

        @Test
        void whenInvalidType_thenThrows() {
            Property property = new Property();
            property.setId(10L);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            assertThatThrownBy(() -> service.createSensor("kc-1",
                    new CreateEnvironmentSensorDto("X", 10L, null, "NOPE", null, null)))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("refreshStatus")
    class RefreshStatus {

        @Test
        void whenSmokeTransitionsToDetected_thenNotifiesAdmins() {
            EnvironmentSensor s = buildSensor(SensorType.SMOKE, "tuya-1");
            s.setSmokeDetected(false);
            when(sensorRepository.findById(1L)).thenReturn(Optional.of(s));
            when(sensorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(tuyaApiService.getDeviceStatus("tuya-1"))
                    .thenReturn(tuyaStatus(Map.of("code", "smoke_sensor_status", "value", "alarm")));
            when(tuyaApiService.getDeviceInfo("tuya-1")).thenReturn(Map.of("online", true));
            when(propertyRepository.findById(10L)).thenReturn(Optional.empty());

            service.refreshStatus("kc-1", 1L);

            assertThat(s.getSmokeDetected()).isTrue();
            assertThat(s.getLastEventAt()).isNotNull();
            verify(notificationService).notifyAdminsAndManagersByOrgId(
                    eq(1L), eq(NotificationKey.IOT_SMOKE_DETECTED), anyString(), anyString(), anyString());
        }

        @Test
        void whenSmokeDetectedButCooldownActive_thenNoNotification() {
            EnvironmentSensor s = buildSensor(SensorType.SMOKE, "tuya-1");
            s.setSmokeDetected(false);
            s.setLastAlertAt(LocalDateTime.now().minusMinutes(2)); // cooldown 10 min actif
            when(sensorRepository.findById(1L)).thenReturn(Optional.of(s));
            when(sensorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(tuyaApiService.getDeviceStatus("tuya-1"))
                    .thenReturn(tuyaStatus(Map.of("code", "smoke_sensor_status", "value", "alarm")));
            when(tuyaApiService.getDeviceInfo("tuya-1")).thenReturn(Map.of("online", true));
            when(propertyRepository.findById(10L)).thenReturn(Optional.empty());

            service.refreshStatus("kc-1", 1L);

            assertThat(s.getSmokeDetected()).isTrue();
            verifyNoInteractions(notificationService);
        }

        @Test
        void whenContactOpen_thenParsesContactState() {
            EnvironmentSensor s = buildSensor(SensorType.CONTACT, "tuya-1");
            when(sensorRepository.findById(1L)).thenReturn(Optional.of(s));
            when(sensorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(tuyaApiService.getDeviceStatus("tuya-1"))
                    .thenReturn(tuyaStatus(Map.of("code", "doorcontact_state", "value", true)));
            when(tuyaApiService.getDeviceInfo("tuya-1")).thenReturn(Map.of("online", true));
            when(propertyRepository.findById(10L)).thenReturn(Optional.empty());

            EnvironmentSensorDto dto = service.refreshStatus("kc-1", 1L);

            assertThat(dto.contactOpen()).isTrue();
            assertThat(dto.online()).isTrue();
        }

        @Test
        void whenTempHumidity_thenParsesScaledTemperature() {
            EnvironmentSensor s = buildSensor(SensorType.TEMP_HUMIDITY, "tuya-1");
            when(sensorRepository.findById(1L)).thenReturn(Optional.of(s));
            when(sensorRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(tuyaApiService.getDeviceStatus("tuya-1")).thenReturn(tuyaStatus(
                    Map.of("code", "va_temperature", "value", 215),
                    Map.of("code", "va_humidity", "value", 55)));
            when(tuyaApiService.getDeviceInfo("tuya-1")).thenReturn(Map.of("online", true));
            when(propertyRepository.findById(10L)).thenReturn(Optional.empty());

            EnvironmentSensorDto dto = service.refreshStatus("kc-1", 1L);

            assertThat(dto.temperatureC()).isEqualTo(21.5);
            assertThat(dto.humidity()).isEqualTo(55);
        }
    }

    @Nested
    @DisplayName("deleteSensor")
    class DeleteSensor {

        @Test
        void whenExists_thenReleasesTuyaAndDeletes() {
            EnvironmentSensor s = buildSensor(SensorType.MOTION, "tuya-1");
            when(sensorRepository.findById(1L)).thenReturn(Optional.of(s));

            service.deleteSensor("kc-1", 1L);

            verify(claimService).release("tuya-1");
            verify(sensorRepository).delete(s);
        }

        @Test
        void whenNotFound_thenThrows() {
            when(sensorRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteSensor("kc-1", 99L))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
