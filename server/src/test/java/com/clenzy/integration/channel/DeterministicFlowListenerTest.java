package com.clenzy.integration.channel;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Consumer calendar.updates des flux deterministes (fiche 08) : relais mince
 * BOOKED/CANCELLED vers le moteur AutomationRule, tolerance aux payloads
 * malformes.
 */
@ExtendWith(MockitoExtension.class)
class DeterministicFlowListenerTest {

    @Mock private AutomationEngine automationEngine;

    private DeterministicFlowListener listener;

    @BeforeEach
    void setUp() {
        listener = new DeterministicFlowListener(automationEngine, new ObjectMapper());
    }

    private static Map<String, Object> bookedEvent() {
        Map<String, Object> event = new HashMap<>();
        event.put("action", "BOOKED");
        event.put("orgId", 1L);
        event.put("propertyId", 100L);
        event.put("reservationId", 42L);
        event.put("from", "2026-07-10");
        event.put("to", "2026-07-14");
        return event;
    }

    @Test
    void whenBookedEvent_thenFiresReservationBookedTriggerWithStayData() {
        listener.onCalendarUpdate(bookedEvent());

        ArgumentCaptor<AutomationSubject> captor = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(automationEngine).fireTrigger(
            eq(AutomationTrigger.RESERVATION_BOOKED), eq(1L), captor.capture());
        AutomationSubject subject = captor.getValue();
        assertThat(subject.subjectType()).isEqualTo(AutomationSubject.TYPE_RESERVATION);
        assertThat(subject.subjectId()).isEqualTo(42L);
        assertThat(subject.data())
            .containsEntry(AutomationSubject.DATA_PROPERTY_ID, 100L)
            .containsEntry(AutomationSubject.DATA_RESERVATION_ID, 42L)
            .containsEntry(AutomationSubject.DATA_CHECK_IN, "2026-07-10")
            .containsEntry(AutomationSubject.DATA_CHECK_OUT, "2026-07-14");
    }

    @Test
    void whenCancelledEvent_thenFiresReservationCancelledTrigger() {
        Map<String, Object> event = bookedEvent();
        event.put("action", "CANCELLED");

        listener.onCalendarUpdate(event);

        verify(automationEngine).fireTrigger(
            eq(AutomationTrigger.RESERVATION_CANCELLED), eq(1L), any(AutomationSubject.class));
    }

    @Test
    void whenStringPayload_thenParsedAndFired() {
        listener.onCalendarUpdate(
            "{\"action\":\"BOOKED\",\"orgId\":1,\"propertyId\":100,\"reservationId\":42," +
            "\"from\":\"2026-07-10\",\"to\":\"2026-07-14\"}");

        verify(automationEngine).fireTrigger(
            eq(AutomationTrigger.RESERVATION_BOOKED), eq(1L), any(AutomationSubject.class));
    }

    @Test
    void whenOtherAction_thenIgnored() {
        Map<String, Object> event = bookedEvent();
        event.put("action", "BLOCKED");

        listener.onCalendarUpdate(event);

        verifyNoInteractions(automationEngine);
    }

    @Test
    void whenMissingOrgOrProperty_thenIgnored() {
        Map<String, Object> event = bookedEvent();
        event.remove("orgId");

        listener.onCalendarUpdate(event);

        verifyNoInteractions(automationEngine);
    }

    @Test
    void whenMissingReservationId_thenIgnored_backfillWillCatchUp() {
        // Sans reservationId, le sujet d'idempotence du moteur serait la propriete :
        // un BOOKED dedupliquerait toutes les resas futures. Delegue au filet quotidien.
        Map<String, Object> event = bookedEvent();
        event.remove("reservationId");

        listener.onCalendarUpdate(event);

        verifyNoInteractions(automationEngine);
    }

    @Test
    void whenMalformedPayload_thenIgnoredWithoutThrowing() {
        listener.onCalendarUpdate("not-a-json{");
        listener.onCalendarUpdate(12345);
        listener.onCalendarUpdate(null);

        verifyNoInteractions(automationEngine);
    }
}
