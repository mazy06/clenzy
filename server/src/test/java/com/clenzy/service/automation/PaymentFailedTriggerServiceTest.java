package com.clenzy.service.automation;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Intervention;
import com.clenzy.repository.InterventionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentFailedTriggerService (capteur F5c)")
class PaymentFailedTriggerServiceTest {

    @Mock private InterventionRepository interventionRepository;
    @Mock private AutomationEngine automationEngine;

    @InjectMocks
    private PaymentFailedTriggerService service;

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
}
