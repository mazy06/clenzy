package com.clenzy.controller;

import com.clenzy.dto.GuestMessageLogDto;
import com.clenzy.dto.MessagingAutomationConfigDto;
import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessagingAutomationConfig;
import com.clenzy.repository.GuestMessageLogRepository;
import com.clenzy.repository.MessagingAutomationConfigRepository;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Configuration de l'automatisation messagerie + envoi manuel + historique.
 */
@RestController
@RequestMapping("/api/guest-messaging")
@PreAuthorize("isAuthenticated()")
public class GuestMessagingController {

    private final MessagingAutomationConfigRepository configRepository;
    private final GuestMessageLogRepository messageLogRepository;
    private final GuestMessagingService messagingService;
    private final TenantContext tenantContext;

    public GuestMessagingController(
            MessagingAutomationConfigRepository configRepository,
            GuestMessageLogRepository messageLogRepository,
            GuestMessagingService messagingService,
            TenantContext tenantContext
    ) {
        this.configRepository = configRepository;
        this.messageLogRepository = messageLogRepository;
        this.messagingService = messagingService;
        this.tenantContext = tenantContext;
    }

    // ── Configuration d'automatisation ──

    @GetMapping("/config")
    public ResponseEntity<MessagingAutomationConfigDto> getConfig() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return configRepository.findByOrganizationId(orgId)
            .map(MessagingAutomationConfigDto::fromEntity)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.ok(MessagingAutomationConfigDto.fromEntity(
                new MessagingAutomationConfig(orgId))));
    }

    @PutMapping("/config")
    public ResponseEntity<MessagingAutomationConfigDto> updateConfig(
            @RequestBody MessagingAutomationConfigDto dto
    ) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        MessagingAutomationConfig config = configRepository.findByOrganizationId(orgId)
            .orElseGet(() -> new MessagingAutomationConfig(orgId));

        config.setAutoSendCheckIn(dto.autoSendCheckIn());
        config.setAutoSendCheckOut(dto.autoSendCheckOut());
        config.setHoursBeforeCheckIn(dto.hoursBeforeCheckIn());
        config.setHoursBeforeCheckOut(dto.hoursBeforeCheckOut());
        config.setCheckInTemplateId(dto.checkInTemplateId());
        config.setCheckOutTemplateId(dto.checkOutTemplateId());
        config.setAutoPushPricingEnabled(dto.autoPushPricingEnabled());

        MessagingAutomationConfig saved = configRepository.save(config);
        return ResponseEntity.ok(MessagingAutomationConfigDto.fromEntity(saved));
    }

    // ── Envoi manuel ──

    @PostMapping("/send")
    public ResponseEntity<GuestMessageLogDto> sendMessage(@RequestBody Map<String, Long> request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long reservationId = request.get("reservationId");
        Long templateId = request.get("templateId");

        if (reservationId == null || templateId == null) {
            return ResponseEntity.badRequest().build();
        }

        GuestMessageLog logEntry = messagingService.sendMessage(reservationId, templateId, orgId);
        return ResponseEntity.ok(GuestMessageLogDto.fromEntity(logEntry));
    }

    // ── Historique ──

    @GetMapping("/history")
    public List<GuestMessageLogDto> getHistory() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return messageLogRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId).stream()
            .map(GuestMessageLogDto::fromEntity)
            .toList();
    }

    @GetMapping("/history/reservation/{reservationId}")
    public List<GuestMessageLogDto> getReservationHistory(@PathVariable Long reservationId) {
        return messageLogRepository.findByReservationIdOrderByCreatedAtDesc(reservationId).stream()
            .map(GuestMessageLogDto::fromEntity)
            .toList();
    }
}
