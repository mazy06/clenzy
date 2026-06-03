package com.clenzy.service;

import com.clenzy.dto.thermostat.CreateThermostatDto;
import com.clenzy.dto.thermostat.ThermostatDto;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.model.Property;
import com.clenzy.model.Thermostat;
import com.clenzy.model.Thermostat.ThermostatStatus;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ThermostatRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ThermostatService")
class ThermostatServiceTest {

    private static final String USER = "kc-user-1";

    @Mock private ThermostatRepository thermostatRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private TuyaApiService tuyaApiService;
    @Mock private TenantContext tenantContext;

    private ThermostatService service;

    @BeforeEach
    void setUp() {
        service = new ThermostatService(thermostatRepository, propertyRepository, tuyaApiService, tenantContext);
    }

    private Thermostat persisted(String externalId) {
        Thermostat t = new Thermostat();
        t.setId(1L);
        t.setName("Salon");
        t.setPropertyId(10L);
        t.setExternalDeviceId(externalId);
        t.setStatus(ThermostatStatus.ACTIVE);
        return t;
    }

    @Test
    @DisplayName("createThermostat — valide la propriete, defaut brand TUYA, set org")
    void create_setsDefaults() {
        Property property = org.mockito.Mockito.mock(Property.class);
        when(property.getId()).thenReturn(10L);
        when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(99L);
        when(thermostatRepository.save(any(Thermostat.class))).thenAnswer(inv -> inv.getArgument(0));

        ThermostatDto dto = service.createThermostat(USER, new CreateThermostatDto("Salon", 10L, "RDC", null, "tuya-1"));

        ArgumentCaptor<Thermostat> captor = ArgumentCaptor.forClass(Thermostat.class);
        verify(thermostatRepository).save(captor.capture());
        Thermostat saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(USER);
        assertThat(saved.getBrand()).isEqualTo("TUYA"); // defaut
        assertThat(saved.getOrganizationId()).isEqualTo(99L);
        assertThat(saved.getExternalDeviceId()).isEqualTo("tuya-1");
        assertThat(dto.name()).isEqualTo("Salon");
        assertThat(dto.status()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("createThermostat — propriete introuvable -> IllegalArgumentException")
    void create_unknownProperty() {
        when(propertyRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.createThermostat(USER, new CreateThermostatDto("X", 404L, null, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("getUserThermostats — mappe entite -> DTO (online si ACTIVE)")
    void list_maps() {
        Thermostat t = persisted("tuya-1");
        t.setCurrentTempC(new java.math.BigDecimal("21.5"));
        when(thermostatRepository.findByStatus(ThermostatStatus.ACTIVE)).thenReturn(List.of(t));

        List<ThermostatDto> result = service.getUserThermostats(USER);

        assertThat(result).singleElement().satisfies(d -> {
            assertThat(d.online()).isTrue();
            assertThat(d.currentTempC()).isEqualTo(21.5);
        });
    }

    @Test
    @DisplayName("refreshStatus — parse les DP Tuya (echelle /10), mappe le mode, met en cache")
    void refresh_parsesTuyaDps() {
        Thermostat t = persisted("tuya-1");
        when(thermostatRepository.findById(1L)).thenReturn(Optional.of(t));
        when(tuyaApiService.getDeviceStatus("tuya-1")).thenReturn(Map.of("result", List.of(
                Map.of("code", "temp_current", "value", 215),  // -> 21.5
                Map.of("code", "temp_set", "value", 220),       // -> 22.0
                Map.of("code", "humidity", "value", 46),
                Map.of("code", "mode", "value", "hot")          // -> heat
        )));
        when(thermostatRepository.save(any(Thermostat.class))).thenAnswer(inv -> inv.getArgument(0));

        ThermostatDto dto = service.refreshStatus(USER, 1L);

        assertThat(dto.currentTempC()).isEqualTo(21.5);
        assertThat(dto.targetTempC()).isEqualTo(22.0);
        assertThat(dto.humidity()).isEqualTo(46);
        assertThat(dto.mode()).isEqualTo("heat");
        verify(thermostatRepository).save(t);
    }

    @Test
    @DisplayName("refreshStatus — pas d'ID Tuya -> aucun appel Tuya")
    void refresh_noExternalId() {
        Thermostat t = persisted(null);
        when(thermostatRepository.findById(1L)).thenReturn(Optional.of(t));

        service.refreshStatus(USER, 1L);

        verify(tuyaApiService, never()).getDeviceStatus(any());
    }

    @Test
    @DisplayName("setTargetTemp — envoie la commande Tuya (x10) et met la consigne en cache")
    void setTarget_sendsCommand() {
        Thermostat t = persisted("tuya-1");
        when(thermostatRepository.findById(1L)).thenReturn(Optional.of(t));
        when(thermostatRepository.save(any(Thermostat.class))).thenAnswer(inv -> inv.getArgument(0));

        ThermostatDto dto = service.setTargetTemp(USER, 1L, 21.5);

        assertThat(dto.targetTempC()).isEqualTo(21.5);
        verify(tuyaApiService).sendCommand(eq("tuya-1"), anyList());
    }

    @Test
    @DisplayName("setTargetTemp — pas d'ID Tuya -> IllegalStateException")
    void setTarget_noExternalId() {
        Thermostat t = persisted(null);
        when(thermostatRepository.findById(1L)).thenReturn(Optional.of(t));

        assertThatThrownBy(() -> service.setTargetTemp(USER, 1L, 20.0))
                .isInstanceOf(IllegalStateException.class);
    }
}
