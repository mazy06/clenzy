package com.clenzy.service.automation;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.service.ServiceRequestService.AutoCleaningOutcome;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Executeurs CREATE_CLEANING_REQUEST / CANCEL_LINKED_CLEANING_REQUEST (fiche 08,
 * F1a/F2a) : resolution du sejour depuis la reservation du contexte (chemin
 * draine, data vide) ou depuis les donnees du capteur, mapping du resultat.
 */
@ExtendWith(MockitoExtension.class)
class CreateCleaningRequestExecutorTest {

    @Mock private ServiceRequestService serviceRequestService;

    @InjectMocks
    private CreateCleaningRequestExecutor createExecutor;

    private AutomationRule rule;

    private static final Long ORG_ID = 1L;
    private static final LocalDate CHECK_IN = LocalDate.of(2026, 7, 10);
    private static final LocalDate CHECK_OUT = LocalDate.of(2026, 7, 14);

    @BeforeEach
    void setUp() {
        rule = new AutomationRule();
        rule.setId(9L);
    }

    private static Reservation reservation() {
        Property property = new Property();
        property.setId(100L);
        Reservation reservation = new Reservation();
        reservation.setId(42L);
        reservation.setProperty(property);
        reservation.setCheckIn(CHECK_IN);
        reservation.setCheckOut(CHECK_OUT);
        return reservation;
    }

    @Test
    void whenReservationResolvedByEngine_thenUsesIt_evenWithEmptyData() {
        // Chemin draine : data VIDE, seule la reservation du contexte fait foi.
        var ctx = new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_RESERVATION,
            42L, Map.of(), reservation());
        ServiceRequest created = new ServiceRequest();
        created.setId(55L);
        when(serviceRequestService.createAutomaticCleaningRequest(
                ORG_ID, 100L, CHECK_IN, CHECK_OUT, 42L))
            .thenReturn(new AutoCleaningOutcome(created, null));

        var result = createExecutor.execute(rule, ctx);

        assertThat(result.skipped()).isFalse();
    }

    @Test
    void whenNoReservation_thenFallsBackToSensorData() {
        var ctx = new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_RESERVATION, 42L,
            Map.of(
                AutomationSubject.DATA_PROPERTY_ID, 100L,
                AutomationSubject.DATA_CHECK_IN, "2026-07-10",
                AutomationSubject.DATA_CHECK_OUT, "2026-07-14"),
            null);
        when(serviceRequestService.createAutomaticCleaningRequest(
                ORG_ID, 100L, CHECK_IN, CHECK_OUT, 42L))
            .thenReturn(new AutoCleaningOutcome(null, "frequence menage WEEKLY (AFTER_EACH_STAY requis)"));

        var result = createExecutor.execute(rule, ctx);

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("WEEKLY");
    }

    @Test
    void whenSubjectUnresolvable_thenFailsExplicitly() {
        var ctx = new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_RESERVATION, 42L,
            Map.of(), null);

        assertThatThrownBy(() -> createExecutor.execute(rule, ctx))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void cancelExecutor_delegatesAndMapsOutcome() {
        CancelLinkedCleaningRequestExecutor cancelExecutor =
            new CancelLinkedCleaningRequestExecutor(serviceRequestService);
        var ctx = new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_RESERVATION,
            42L, Map.of(), reservation());
        ServiceRequest cancelled = new ServiceRequest();
        cancelled.setId(55L);
        when(serviceRequestService.cancelAutomaticCleaningRequest(
                eq(ORG_ID), eq(100L), eq(CHECK_IN), eq(CHECK_OUT)))
            .thenReturn(new AutoCleaningOutcome(cancelled, null));

        var result = cancelExecutor.execute(rule, ctx);

        assertThat(result.skipped()).isFalse();
    }

    @Test
    void cancelExecutor_whenNothingToCancel_thenSkipsWithReason() {
        CancelLinkedCleaningRequestExecutor cancelExecutor =
            new CancelLinkedCleaningRequestExecutor(serviceRequestService);
        var ctx = new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_RESERVATION,
            42L, Map.of(), reservation());
        when(serviceRequestService.cancelAutomaticCleaningRequest(
                eq(ORG_ID), eq(100L), eq(CHECK_IN), eq(CHECK_OUT)))
            .thenReturn(new AutoCleaningOutcome(null, "aucune demande de menage auto pour ce sejour"));

        var result = cancelExecutor.execute(rule, ctx);

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("aucune demande");
    }
}
