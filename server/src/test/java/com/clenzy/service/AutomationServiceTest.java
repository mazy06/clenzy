package com.clenzy.service;

import com.clenzy.dto.AutomationTriggerDto;
import com.clenzy.model.ExternalAutomation;
import com.clenzy.model.ExternalAutomation.AutomationEvent;
import com.clenzy.model.ExternalAutomation.AutomationPlatform;
import com.clenzy.repository.ExternalAutomationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutomationServiceTest {

    @Mock private ExternalAutomationRepository triggerRepository;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks private AutomationService service;

    private static final Long ORG_ID = 1L;

    private ExternalAutomation createTrigger(boolean active) {
        ExternalAutomation t = new ExternalAutomation();
        t.setId(1L);
        t.setOrganizationId(ORG_ID);
        t.setTriggerName("New Reservation");
        t.setPlatform(AutomationPlatform.ZAPIER);
        t.setTriggerEvent(AutomationEvent.RESERVATION_CREATED);
        t.setCallbackUrl("https://hooks.zapier.com/test");
        t.setIsActive(active);
        t.setTriggerCount(0L);
        return t;
    }

    @Test
    void createTrigger_success() {
        when(triggerRepository.save(any())).thenAnswer(inv -> {
            ExternalAutomation saved = inv.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        AutomationTriggerDto result = service.createTrigger(
            "New Reservation", AutomationPlatform.ZAPIER,
            AutomationEvent.RESERVATION_CREATED, "https://hooks.zapier.com/test", ORG_ID);

        assertNotNull(result);
        assertEquals("New Reservation", result.triggerName());
        assertEquals(AutomationPlatform.ZAPIER, result.platform());
        assertEquals(AutomationEvent.RESERVATION_CREATED, result.triggerEvent());
        assertTrue(result.isActive());
    }

    @Test
    void deleteTrigger_success() {
        ExternalAutomation trigger = createTrigger(true);
        when(triggerRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(trigger));

        service.deleteTrigger(1L, ORG_ID);

        verify(triggerRepository).delete(trigger);
    }

    @Test
    void deleteTrigger_notFound_throws() {
        when(triggerRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.deleteTrigger(1L, ORG_ID));
    }

    @Test
    void toggleTrigger_activateDeactivate() {
        ExternalAutomation trigger = createTrigger(true);
        when(triggerRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(trigger));
        when(triggerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AutomationTriggerDto result = service.toggleTrigger(1L, ORG_ID);

        assertFalse(result.isActive());
    }

    @Test
    void toggleTrigger_deactivateActivate() {
        ExternalAutomation trigger = createTrigger(false);
        when(triggerRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(trigger));
        when(triggerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AutomationTriggerDto result = service.toggleTrigger(1L, ORG_ID);

        assertTrue(result.isActive());
    }

    @Test
    void fireEvent_noTriggers() {
        when(triggerRepository.findActiveByEvent(AutomationEvent.RESERVATION_CREATED, ORG_ID))
            .thenReturn(List.of());

        int count = service.fireEvent(AutomationEvent.RESERVATION_CREATED, "data", ORG_ID);

        assertEquals(0, count);
    }

    @Test
    void getAllTriggers_returnsMappedDtos() {
        ExternalAutomation trigger = createTrigger(true);
        when(triggerRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of(trigger));

        List<AutomationTriggerDto> result = service.getAllTriggers(ORG_ID);

        assertEquals(1, result.size());
        assertEquals(AutomationPlatform.ZAPIER, result.get(0).platform());
    }

    @Test
    void getAllTriggers_emptyList_returnsEmpty() {
        when(triggerRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of());

        List<AutomationTriggerDto> result = service.getAllTriggers(ORG_ID);

        assertTrue(result.isEmpty());
    }

    @Test
    void getById_existing_returnsMappedDto() {
        ExternalAutomation trigger = createTrigger(true);
        when(triggerRepository.findByIdAndOrgId(1L, ORG_ID)).thenReturn(Optional.of(trigger));

        AutomationTriggerDto result = service.getById(1L, ORG_ID);

        assertEquals(AutomationEvent.RESERVATION_CREATED, result.triggerEvent());
        assertEquals("New Reservation", result.triggerName());
    }

    @Test
    void getById_notFound_throwsIllegalArgument() {
        when(triggerRepository.findByIdAndOrgId(99L, ORG_ID)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.getById(99L, ORG_ID));
    }

    @Test
    void createTrigger_persistsActiveByDefault() {
        when(triggerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AutomationTriggerDto result = service.createTrigger(
            "My Trigger", AutomationPlatform.MAKE,
            AutomationEvent.PAYOUT_GENERATED, "https://make.com/hook", ORG_ID);

        assertTrue(result.isActive());
        assertEquals(AutomationPlatform.MAKE, result.platform());
        assertEquals(AutomationEvent.PAYOUT_GENERATED, result.triggerEvent());
    }

    @Test
    void fireEvent_unreachableCallback_returnsZero() {
        ExternalAutomation trigger = createTrigger(true);
        trigger.setCallbackUrl("http://127.0.0.1:1/never-reachable");
        when(triggerRepository.findActiveByEvent(AutomationEvent.RESERVATION_CREATED, ORG_ID))
            .thenReturn(List.of(trigger));

        int count = service.fireEvent(AutomationEvent.RESERVATION_CREATED, "data", ORG_ID);

        assertEquals(0, count); // HTTP call fails silently, returns 0
    }

    @Test
    void fireEvent_malformedUrl_skipsAndReturnsZero() {
        ExternalAutomation trigger = createTrigger(true);
        trigger.setCallbackUrl("not-a-url");
        when(triggerRepository.findActiveByEvent(AutomationEvent.MESSAGE_RECEIVED, ORG_ID))
            .thenReturn(List.of(trigger));

        int count = service.fireEvent(AutomationEvent.MESSAGE_RECEIVED, "p", ORG_ID);

        assertEquals(0, count);
    }
}
