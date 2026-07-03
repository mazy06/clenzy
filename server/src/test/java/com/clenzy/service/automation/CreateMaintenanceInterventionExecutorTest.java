package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.Property;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.service.automation.AutomationActionExecutor.ExecutionResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("CreateMaintenanceInterventionExecutor (F7a batterie serrure)")
class CreateMaintenanceInterventionExecutorTest {

    private static final Long ORG_ID = 1L;
    private static final Long DEVICE_ID = 42L;
    private static final Long PROPERTY_ID = 7L;

    @Mock private SmartLockDeviceRepository deviceRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private NoiseAlertRepository noiseAlertRepository;

    private CreateMaintenanceInterventionExecutor executor;

    @BeforeEach
    void setUp() {
        executor = new CreateMaintenanceInterventionExecutor(
                deviceRepository, interventionRepository, propertyRepository, noiseAlertRepository);
    }

    private static AutomationRule rule() {
        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(ORG_ID);
        rule.setName("batterie");
        return rule;
    }

    private static AutomationActionContext ctx(String subjectType, Long subjectId) {
        return new AutomationActionContext(ORG_ID, subjectType, subjectId,
                Map.of(CreateMaintenanceInterventionExecutor.DATA_BATTERY_LEVEL, 8));
    }

    private SmartLockDevice device() {
        SmartLockDevice device = new SmartLockDevice();
        device.setId(DEVICE_ID);
        device.setOrganizationId(ORG_ID);
        device.setPropertyId(PROPERTY_ID);
        device.setName("Entree principale");
        return device;
    }

    private Property property(User owner) {
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setOrganizationId(ORG_ID);
        property.setName("Loft Marais");
        property.setOwner(owner);
        return property;
    }

    @Test
    @DisplayName("action() -> CREATE_MAINTENANCE_INTERVENTION")
    void actionType() {
        assertThat(executor.action()).isEqualTo(AutomationAction.CREATE_MAINTENANCE_INTERVENTION);
    }

    @Test
    @DisplayName("sujet inattendu -> echec explicite")
    void wrongSubjectType_throws() {
        assertThatThrownBy(() -> executor.execute(rule(), ctx("RESERVATION", 5L)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SMART_LOCK_DEVICE");
    }

    // ── F6b : sujet NOISE_ALERT (escalade bruit → intervention de verification) ──

    private NoiseAlert alert() {
        NoiseAlert alert = new NoiseAlert();
        alert.setId(66L);
        alert.setOrganizationId(ORG_ID);
        alert.setPropertyId(PROPERTY_ID);
        return alert;
    }

    private static AutomationActionContext noiseCtx() {
        return new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_NOISE_ALERT, 66L,
                Map.of(AutomationSubject.DATA_ALERTS_LAST_24H, 4,
                       AutomationSubject.DATA_MEASURED_DB, 82));
    }

    @Test
    @DisplayName("bruit : alerte introuvable -> echec explicite")
    void noiseAlertNotFound_throws() {
        when(noiseAlertRepository.findById(66L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> executor.execute(rule(), noiseCtx()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("introuvable");
    }

    @Test
    @DisplayName("bruit : alerte d'une autre org -> echec explicite (ownership)")
    void noiseAlertCrossOrg_throws() {
        NoiseAlert alert = alert();
        alert.setOrganizationId(999L);
        when(noiseAlertRepository.findById(66L)).thenReturn(Optional.of(alert));

        assertThatThrownBy(() -> executor.execute(rule(), noiseCtx()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("organisation");
        verify(interventionRepository, never()).save(any());
    }

    @Test
    @DisplayName("bruit : intervention de verification deja ouverte -> SKIPPED (episode couvert)")
    void noiseOpenInterventionExists_skips() {
        when(noiseAlertRepository.findById(66L)).thenReturn(Optional.of(alert()));
        when(interventionRepository.existsOpenByPropertyAndMarker(
                eq(PROPERTY_ID), eq(ORG_ID), anyList(),
                eq(CreateMaintenanceInterventionExecutor.noiseMarker(PROPERTY_ID))))
                .thenReturn(true);

        ExecutionResult result = executor.execute(rule(), noiseCtx());

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("deja ouverte");
        verify(interventionRepository, never()).save(any());
    }

    @Test
    @DisplayName("bruit : cas nominal -> intervention MAINTENANCE de verification avec marqueur bruit")
    void noiseEscalation_createsVerificationIntervention() {
        User owner = new User();
        when(noiseAlertRepository.findById(66L)).thenReturn(Optional.of(alert()));
        when(interventionRepository.existsOpenByPropertyAndMarker(
                eq(PROPERTY_ID), eq(ORG_ID), anyList(), anyString())).thenReturn(false);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property(owner)));

        ExecutionResult result = executor.execute(rule(), noiseCtx());

        assertThat(result.skipped()).isFalse();
        ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(captor.capture());
        Intervention created = captor.getValue();

        assertThat(created.getType()).isEqualTo("MAINTENANCE");
        assertThat(created.getStatus()).isEqualTo(InterventionStatus.PENDING);
        assertThat(created.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(created.getRequestor()).isSameAs(owner);
        assertThat(created.getTitle()).contains("Verification bruit").contains("Loft Marais");
        assertThat(created.getDescription()).contains("4 alertes sur 24 h").contains("82 dB");
        assertThat(created.getSpecialInstructions())
                .contains(CreateMaintenanceInterventionExecutor.noiseMarker(PROPERTY_ID));
        assertThat(created.getScheduledDate().toLocalDate())
                .isEqualTo(LocalDate.now(ZoneId.systemDefault()).plusDays(1));
    }

    @Test
    @DisplayName("serrure introuvable -> echec explicite")
    void deviceNotFound_throws() {
        when(deviceRepository.findById(DEVICE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> executor.execute(rule(),
                ctx(CreateMaintenanceInterventionExecutor.SUBJECT_SMART_LOCK_DEVICE, DEVICE_ID)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("serrure d'une autre org -> echec explicite (ownership)")
    void crossOrgDevice_throws() {
        SmartLockDevice device = device();
        device.setOrganizationId(999L);
        when(deviceRepository.findById(DEVICE_ID)).thenReturn(Optional.of(device));

        assertThatThrownBy(() -> executor.execute(rule(),
                ctx(CreateMaintenanceInterventionExecutor.SUBJECT_SMART_LOCK_DEVICE, DEVICE_ID)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("organisation");
        verify(interventionRepository, never()).save(any());
    }

    @Test
    @DisplayName("serrure sans propriete -> SKIPPED sans creation")
    void deviceWithoutProperty_skips() {
        SmartLockDevice device = device();
        device.setPropertyId(null);
        when(deviceRepository.findById(DEVICE_ID)).thenReturn(Optional.of(device));

        ExecutionResult result = executor.execute(rule(),
                ctx(CreateMaintenanceInterventionExecutor.SUBJECT_SMART_LOCK_DEVICE, DEVICE_ID));

        assertThat(result.skipped()).isTrue();
        verify(interventionRepository, never()).save(any());
    }

    @Test
    @DisplayName("idempotence : intervention batterie deja ouverte -> SKIPPED, aucune nouvelle creation")
    void openInterventionExists_skips() {
        when(deviceRepository.findById(DEVICE_ID)).thenReturn(Optional.of(device()));
        when(interventionRepository.existsOpenByPropertyAndMarker(
                eq(PROPERTY_ID), eq(ORG_ID), anyList(), anyString())).thenReturn(true);

        ExecutionResult result = executor.execute(rule(),
                ctx(CreateMaintenanceInterventionExecutor.SUBJECT_SMART_LOCK_DEVICE, DEVICE_ID));

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("deja ouverte");
        verify(interventionRepository, never()).save(any());
        verify(propertyRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("propriete sans owner -> SKIPPED sans creation (requestor obligatoire)")
    void propertyWithoutOwner_skips() {
        when(deviceRepository.findById(DEVICE_ID)).thenReturn(Optional.of(device()));
        when(interventionRepository.existsOpenByPropertyAndMarker(
                eq(PROPERTY_ID), eq(ORG_ID), anyList(), anyString())).thenReturn(false);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property(null)));

        ExecutionResult result = executor.execute(rule(),
                ctx(CreateMaintenanceInterventionExecutor.SUBJECT_SMART_LOCK_DEVICE, DEVICE_ID));

        assertThat(result.skipped()).isTrue();
        verify(interventionRepository, never()).save(any());
    }

    @Test
    @DisplayName("cas nominal : intervention MAINTENANCE creee au lendemain 10:00 avec marqueur d'idempotence")
    void createsPreventiveIntervention() {
        User owner = new User();
        when(deviceRepository.findById(DEVICE_ID)).thenReturn(Optional.of(device()));
        when(interventionRepository.existsOpenByPropertyAndMarker(
                eq(PROPERTY_ID), eq(ORG_ID), anyList(), anyString())).thenReturn(false);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property(owner)));

        ExecutionResult result = executor.execute(rule(),
                ctx(CreateMaintenanceInterventionExecutor.SUBJECT_SMART_LOCK_DEVICE, DEVICE_ID));

        assertThat(result.skipped()).isFalse();
        ArgumentCaptor<Intervention> captor = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(captor.capture());
        Intervention created = captor.getValue();

        assertThat(created.getType()).isEqualTo("MAINTENANCE");
        assertThat(created.getStatus()).isEqualTo(InterventionStatus.PENDING);
        assertThat(created.getPriority()).isEqualTo("HIGH");
        assertThat(created.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(created.getRequestor()).isSameAs(owner);
        assertThat(created.getTitle()).contains("Entree principale");
        assertThat(created.getDescription()).contains("batterie critique").contains("8%");
        assertThat(created.getSpecialInstructions())
                .contains(CreateMaintenanceInterventionExecutor.marker(DEVICE_ID));
        // Lendemain 10:00 (fuseau du logement — repli systeme sans timezone)
        assertThat(created.getScheduledDate().toLocalDate())
                .isEqualTo(LocalDate.now(ZoneId.systemDefault()).plusDays(1));
        assertThat(created.getScheduledDate().toLocalTime()).isEqualTo(LocalTime.of(10, 0));
    }
}
