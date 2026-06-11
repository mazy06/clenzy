package com.clenzy.controller;

import com.clenzy.dto.PayoutScheduleConfigDto;
import com.clenzy.model.PayoutScheduleConfig;
import com.clenzy.repository.PayoutScheduleConfigRepository;
import com.clenzy.service.PayoutScheduleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayoutScheduleControllerTest {

    @Mock private PayoutScheduleConfigRepository repository;

    private PayoutScheduleController controller;

    @BeforeEach
    void setUp() {
        // Service reel branche sur le mock : les assertions existantes sur le
        // repository restent valables a travers la couche service.
        controller = new PayoutScheduleController(new PayoutScheduleService(repository));
    }

    @Test
    void getScheduleConfig_existing_returnsOk() {
        PayoutScheduleConfig config = new PayoutScheduleConfig();
        config.setId(1L);
        config.setPayoutDaysOfMonth(List.of(5, 15, 25));
        config.setGracePeriodDays(3);
        config.setAutoGenerateEnabled(true);
        when(repository.findAll()).thenReturn(List.of(config));

        ResponseEntity<PayoutScheduleConfigDto> response = controller.getScheduleConfig();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        PayoutScheduleConfigDto body = response.getBody();
        assertNotNull(body);
        assertEquals(1L, body.id());
        assertEquals(List.of(5, 15, 25), body.payoutDaysOfMonth());
        assertEquals(3, body.gracePeriodDays());
        assertTrue(body.autoGenerateEnabled());
    }

    @Test
    void getScheduleConfig_empty_returnsNotFound() {
        when(repository.findAll()).thenReturn(List.of());

        ResponseEntity<PayoutScheduleConfigDto> response = controller.getScheduleConfig();

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void updateScheduleConfig_validDays_sortedDeduped() {
        when(repository.findAll()).thenReturn(List.of());
        when(repository.save(any(PayoutScheduleConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new PayoutScheduleController.UpdatePayoutScheduleRequest(
            List.of(15, 5, 5, 25, 35, 0), 5, true);

        PayoutScheduleConfigDto dto = controller.updateScheduleConfig(req);

        // 35 and 0 are out of range (must be 1-28), duplicates removed, sorted
        assertEquals(List.of(5, 15, 25), dto.payoutDaysOfMonth());
        assertEquals(5, dto.gracePeriodDays());
        assertTrue(dto.autoGenerateEnabled());
    }

    @Test
    void updateScheduleConfig_gracePeriodClampedToMax30() {
        when(repository.findAll()).thenReturn(List.of());
        when(repository.save(any(PayoutScheduleConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new PayoutScheduleController.UpdatePayoutScheduleRequest(null, 100, null);

        PayoutScheduleConfigDto dto = controller.updateScheduleConfig(req);
        assertEquals(30, dto.gracePeriodDays());
    }

    @Test
    void updateScheduleConfig_negativeGracePeriodClampedToZero() {
        when(repository.findAll()).thenReturn(List.of());
        when(repository.save(any(PayoutScheduleConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new PayoutScheduleController.UpdatePayoutScheduleRequest(null, -10, null);

        PayoutScheduleConfigDto dto = controller.updateScheduleConfig(req);
        assertEquals(0, dto.gracePeriodDays());
    }

    @Test
    void updateScheduleConfig_nullFields_keepsExistingValues() {
        PayoutScheduleConfig existing = new PayoutScheduleConfig();
        existing.setPayoutDaysOfMonth(List.of(10, 20));
        existing.setGracePeriodDays(7);
        existing.setAutoGenerateEnabled(true);
        when(repository.findAll()).thenReturn(List.of(existing));
        when(repository.save(any(PayoutScheduleConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new PayoutScheduleController.UpdatePayoutScheduleRequest(null, null, null);

        PayoutScheduleConfigDto dto = controller.updateScheduleConfig(req);
        assertEquals(List.of(10, 20), dto.payoutDaysOfMonth());
        assertEquals(7, dto.gracePeriodDays());
        assertTrue(dto.autoGenerateEnabled());
    }

    @Test
    void updateScheduleConfig_persistsViaSave() {
        when(repository.findAll()).thenReturn(List.of());
        when(repository.save(any(PayoutScheduleConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new PayoutScheduleController.UpdatePayoutScheduleRequest(List.of(1), 1, false);
        controller.updateScheduleConfig(req);

        ArgumentCaptor<PayoutScheduleConfig> captor = ArgumentCaptor.forClass(PayoutScheduleConfig.class);
        verify(repository).save(captor.capture());
        assertEquals(List.of(1), captor.getValue().getPayoutDaysOfMonth());
        assertEquals(1, captor.getValue().getGracePeriodDays());
        assertFalse(captor.getValue().isAutoGenerateEnabled());
    }
}
