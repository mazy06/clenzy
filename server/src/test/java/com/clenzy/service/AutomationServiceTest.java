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
}
