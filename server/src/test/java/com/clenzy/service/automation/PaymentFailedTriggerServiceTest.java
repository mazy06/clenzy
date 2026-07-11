package com.clenzy.service.automation;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.agent.supervision.AutoApplyGate;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionAutoApplyService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentFailedTriggerService (capteur F5c)")
class PaymentFailedTriggerServiceTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private AutomationEngine automationEngine;
    @Mock private SupervisionActivityService supervisionActivityService;
    @Mock private SupervisionSuggestionService supervisionSuggestionService;
    @Mock private AutoApplyGate autoApplyGate;
    @Mock private SupervisionAutoApplyService autoApplyService;

    @InjectMocks
    private PaymentFailedTriggerService service;

    /** Réservation PARTIALLY_PAID avec solde dû (le seul cas où la carte est applicable). */
    private Reservation partiallyPaidReservation(Long orgId, Long propertyId, Long reservationId) {
        Property property = new Property();
        property.setId(propertyId);
        property.setOrganizationId(orgId);
        Reservation reservation = new Reservation();
        reservation.setId(reservationId);
        reservation.setOrganizationId(orgId);
        reservation.setProperty(property);
        reservation.setPaymentStatus(PaymentStatus.PARTIALLY_PAID);
        reservation.setAmountDue(new BigDecimal("120.00"));
        return reservation;
    }

    @Test
    @DisplayName("metadata interventionId -> org resolue depuis l'intervention, sujet INTERVENTION")
    void interventionMetadata_firesWithInterventionSubject() {
        Intervention intervention = new Intervention();
        intervention.setOrganizationId(7L);
        when(interventionRepository.findById(5L)).thenReturn(Optional.of(intervention));

        service.fireForFailedPaymentIntent("pi_1",
                Map.of("type", "mobile_intervention", "interventionId", "5"));

        ArgumentCaptor<AutomationSubject> captor = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(automationEngine).fireTrigger(eq(AutomationTrigger.PAYMENT_FAILED), eq(7L), captor.capture());
        assertThat(captor.getValue().subjectType()).isEqualTo(NotifyStaffExecutor.SUBJECT_INTERVENTION);
        assertThat(captor.getValue().subjectId()).isEqualTo(5L);
        assertThat(captor.getValue().data())
                .containsEntry(NotifyStaffExecutor.DATA_PAYMENT_INTENT_ID, "pi_1");
    }

    @Test
    @DisplayName("intervention introuvable -> aucun declenchement (logge)")
    void interventionNotFound_doesNotFire() {
        when(interventionRepository.findById(5L)).thenReturn(Optional.empty());

        service.fireForFailedPaymentIntent("pi_1", Map.of("interventionId", "5"));

        verifyNoInteractions(automationEngine);
    }

    @Test
    @DisplayName("metadata org_id + booking_id -> sujet DIRECT_BOOKING")
    void directBookingMetadata_firesWithBookingSubject() {
        service.fireForFailedPaymentIntent("pi_2",
                Map.of("type", "direct_booking", "org_id", "3", "booking_id", "44"));

        ArgumentCaptor<AutomationSubject> captor = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(automationEngine).fireTrigger(eq(AutomationTrigger.PAYMENT_FAILED), eq(3L), captor.capture());
        assertThat(captor.getValue().subjectType()).isEqualTo(NotifyStaffExecutor.SUBJECT_DIRECT_BOOKING);
        assertThat(captor.getValue().subjectId()).isEqualTo(44L);
        verifyNoInteractions(interventionRepository);
    }

    @Test
    @DisplayName("org non resoluble (inscription, upgrade...) -> aucun declenchement")
    void unresolvableOrg_doesNotFire() {
        service.fireForFailedPaymentIntent("pi_3", Map.of("type", "mobile_upgrade", "userId", "9"));

        verifyNoInteractions(automationEngine, interventionRepository);
    }

    @Test
    @DisplayName("metadata numerique corrompue -> aucun declenchement, pas d'exception")
    void corruptedMetadata_doesNotFire() {
        service.fireForFailedPaymentIntent("pi_4",
                Map.of("interventionId", "abc", "org_id", "x", "booking_id", "y"));

        verifyNoInteractions(automationEngine, interventionRepository);
    }

    @Test
    @DisplayName("metadata null -> aucun declenchement, pas d'exception")
    void nullMetadata_doesNotFire() {
        service.fireForFailedPaymentIntent("pi_5", null);

        verifyNoInteractions(automationEngine, interventionRepository);
    }

    // ── V3 : PAYMENT_REMINDER auto (1ʳᵉ relance seulement) ─────────────────────

    @Test
    @DisplayName("V3 : gate AUTO_NOTIFY (1ʳᵉ relance) -> carte creee sans notif pending puis auto-appliquee")
    void firstReminder_gateAllows_autoAppliesViaPipeline() {
        when(reservationRepository.findById(88L))
                .thenReturn(Optional.of(partiallyPaidReservation(3L, 12L, 88L)));
        when(autoApplyGate.decide(eq(3L), eq("fin"), eq(SupervisionActionType.PAYMENT_REMINDER),
                eq(Map.of(AutoApplyGate.INPUT_PAYMENT_RESERVATION_ID, 88L))))
                .thenReturn(AutoApplyGate.AutoDecision.AUTO_NOTIFY);
        when(supervisionSuggestionService.recordActionableForAutoApply(eq(3L), eq(12L), eq("fin"),
                eq(88L), anyString(), anyString(), eq(SupervisionActionType.PAYMENT_REMINDER),
                anyString(), isNull(), eq("warning")))
                .thenReturn(Optional.of(66L));

        service.fireForFailedPaymentIntent("pi_6", Map.of(
                "type", "direct_booking", "org_id", "3", "booking_id", "44",
                "property_id", "12", "reservation_id", "88"));

        verify(autoApplyService).autoApply(eq(AutoApplyGate.AutoDecision.AUTO_NOTIFY),
                eq(3L), eq(12L), eq("fin"), eq(66L), anyString(), anyString(), isNull());
        verify(supervisionSuggestionService, never()).recordActionableStrict(
                any(), any(), anyString(), any(), anyString(), anyString(),
                anyString(), anyString(), any(), anyString());
    }

    @Test
    @DisplayName("V3 : gate CARD (2ᵉ relance / < 72 h) -> carte HITL portant le reservationId, aucun auto")
    void subsequentReminder_gateSaysCard_hitlCardWithReservationId() {
        when(reservationRepository.findById(88L))
                .thenReturn(Optional.of(partiallyPaidReservation(3L, 12L, 88L)));
        when(autoApplyGate.decide(eq(3L), eq("fin"), eq(SupervisionActionType.PAYMENT_REMINDER), any()))
                .thenReturn(AutoApplyGate.AutoDecision.CARD);

        service.fireForFailedPaymentIntent("pi_7", Map.of(
                "type", "direct_booking", "org_id", "3", "booking_id", "44",
                "property_id", "12", "reservation_id", "88"));

        // La carte HITL porte désormais le reservationId (colonne) : la mesure
        // « déjà relancé » couvre aussi les applications humaines.
        verify(supervisionSuggestionService).recordActionableStrict(
                eq(3L), eq(12L), eq("fin"), eq(88L), anyString(), anyString(),
                eq(SupervisionActionType.PAYMENT_REMINDER), anyString(), isNull(), eq("warning"));
        verifyNoInteractions(autoApplyService);
    }
}
