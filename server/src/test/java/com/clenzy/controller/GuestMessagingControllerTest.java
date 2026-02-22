package com.clenzy.controller;

import com.clenzy.dto.MessagingAutomationConfigDto;
import com.clenzy.model.*;
import com.clenzy.repository.GuestMessageLogRepository;
import com.clenzy.repository.MessagingAutomationConfigRepository;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GuestMessagingControllerTest {

    @Mock private MessagingAutomationConfigRepository configRepository;
    @Mock private GuestMessageLogRepository messageLogRepository;
    @Mock private GuestMessagingService messagingService;

    private TenantContext tenantContext;
    private GuestMessagingController controller;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(1L);
        controller = new GuestMessagingController(
            configRepository, messageLogRepository, messagingService, tenantContext);
    }

    // ── Config tests ──

    @Test
    void whenGetConfig_existing_thenReturnsIt() {
        var config = new MessagingAutomationConfig(1L);
        config.setAutoSendCheckIn(true);
        config.setHoursBeforeCheckIn(48);

        when(configRepository.findByOrganizationId(1L))
            .thenReturn(Optional.of(config));

        var response = controller.getConfig();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().autoSendCheckIn());
        assertEquals(48, response.getBody().hoursBeforeCheckIn());
    }

    @Test
    void whenGetConfig_notFound_thenReturnsDefaults() {
        when(configRepository.findByOrganizationId(1L))
            .thenReturn(Optional.empty());

        var response = controller.getConfig();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertFalse(response.getBody().autoSendCheckIn());
        assertFalse(response.getBody().autoSendCheckOut());
        assertEquals(24, response.getBody().hoursBeforeCheckIn());
    }

    @Test
    void whenUpdateConfig_existing_thenUpdatesAndReturns() {
        var existing = new MessagingAutomationConfig(1L);
        when(configRepository.findByOrganizationId(1L))
            .thenReturn(Optional.of(existing));
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var dto = new MessagingAutomationConfigDto(
            true, false, 48, 12, 10L, null, true);

        var response = controller.updateConfig(dto);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().autoSendCheckIn());
        assertEquals(48, response.getBody().hoursBeforeCheckIn());
        assertTrue(response.getBody().autoPushPricingEnabled());
        verify(configRepository).save(existing);
    }

    @Test
    void whenUpdateConfig_newOrg_thenCreatesAndReturns() {
        when(configRepository.findByOrganizationId(1L))
            .thenReturn(Optional.empty());
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var dto = new MessagingAutomationConfigDto(
            false, true, 24, 6, null, 20L, false);

        var response = controller.updateConfig(dto);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().autoSendCheckOut());
        assertEquals(6, response.getBody().hoursBeforeCheckOut());
    }

    // ── Send tests ──

    @Test
    void whenSendMessage_validRequest_thenReturnsLogEntry() {
        GuestMessageLog logEntry = buildLogEntry();
        when(messagingService.sendMessage(100L, 10L, 1L)).thenReturn(logEntry);

        var response = controller.sendMessage(Map.of(
            "reservationId", 100L,
            "templateId", 10L));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("SENT", response.getBody().status());
        verify(messagingService).sendMessage(100L, 10L, 1L);
    }

    @Test
    void whenSendMessage_missingReservationId_thenBadRequest() {
        var response = controller.sendMessage(Map.of("templateId", 10L));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(messagingService, never()).sendMessage(any(), any(), any());
    }

    @Test
    void whenSendMessage_missingTemplateId_thenBadRequest() {
        var response = controller.sendMessage(Map.of("reservationId", 100L));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    // ── History tests ──

    @Test
    void whenGetHistory_thenReturnsMappedList() {
        GuestMessageLog logEntry = buildLogEntry();
        when(messageLogRepository.findByOrganizationIdOrderByCreatedAtDesc(1L))
            .thenReturn(List.of(logEntry));

        var result = controller.getHistory();

        assertEquals(1, result.size());
        assertEquals("EMAIL", result.get(0).channel());
    }

    @Test
    void whenGetReservationHistory_thenReturnsMappedList() {
        GuestMessageLog logEntry = buildLogEntry();
        when(messageLogRepository.findByReservationIdOrderByCreatedAtDesc(100L))
            .thenReturn(List.of(logEntry));

        var result = controller.getReservationHistory(100L);

        assertEquals(1, result.size());
    }

    @Test
    void whenGetHistory_empty_thenReturnsEmptyList() {
        when(messageLogRepository.findByOrganizationIdOrderByCreatedAtDesc(1L))
            .thenReturn(List.of());

        var result = controller.getHistory();

        assertTrue(result.isEmpty());
    }

    // ── Helper ──

    private GuestMessageLog buildLogEntry() {
        MessageTemplate template = new MessageTemplate();
        template.setId(10L);
        template.setName("Check-In Template");
        template.setType(MessageTemplateType.CHECK_IN);

        GuestMessageLog log = new GuestMessageLog();
        log.setId(1L);
        log.setOrganizationId(1L);
        log.setTemplate(template);
        log.setChannel(MessageChannelType.EMAIL);
        log.setRecipient("guest@example.com");
        log.setSubject("Bienvenue");
        log.setStatus(MessageStatus.SENT);
        return log;
    }
}
