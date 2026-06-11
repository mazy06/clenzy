package com.clenzy.controller;

import com.clenzy.dto.GuestMessageLogDto;
import com.clenzy.dto.MessagingAutomationConfigDto;
import com.clenzy.dto.SendManualMessageRequest;
import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessageChannelType;
import com.clenzy.service.messaging.GuestMessagingQueryService;
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

    private final GuestMessagingQueryService queryService;
    private final GuestMessagingService messagingService;
    private final TenantContext tenantContext;

    public GuestMessagingController(
            GuestMessagingQueryService queryService,
            GuestMessagingService messagingService,
            TenantContext tenantContext
    ) {
        this.queryService = queryService;
        this.messagingService = messagingService;
        this.tenantContext = tenantContext;
    }

    // ── Configuration d'automatisation ──

    @GetMapping("/config")
    public ResponseEntity<MessagingAutomationConfigDto> getConfig() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(MessagingAutomationConfigDto.fromEntity(
            queryService.getConfigOrDefault(orgId)));
    }

    @PutMapping("/config")
    public ResponseEntity<MessagingAutomationConfigDto> updateConfig(
            @RequestBody MessagingAutomationConfigDto dto
    ) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(MessagingAutomationConfigDto.fromEntity(
            queryService.updateConfig(orgId, dto)));
    }

    // ── Envoi manuel ──

    @PostMapping("/send")
    public ResponseEntity<GuestMessageLogDto> sendMessage(@RequestBody SendManualMessageRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        if (request.reservationId() == null || request.templateId() == null) {
            return ResponseEntity.badRequest().build();
        }

        MessageChannelType channel = parseChannel(request.channel());
        GuestMessageLog logEntry = messagingService.sendMessage(
            request.reservationId(), request.templateId(), orgId, channel);
        return ResponseEntity.ok(GuestMessageLogDto.fromEntity(logEntry));
    }

    /** Canal demande, repli sur EMAIL si absent ou inconnu. */
    private static MessageChannelType parseChannel(String channel) {
        if (channel == null || channel.isBlank()) {
            return MessageChannelType.EMAIL;
        }
        try {
            return MessageChannelType.valueOf(channel.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return MessageChannelType.EMAIL;
        }
    }

    // ── Renvoi d'un message echoue ──

    @PostMapping("/resend/{logId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or @organizationSecurityService.isOrgAdmin()")
    public ResponseEntity<GuestMessageLogDto> resendMessage(@PathVariable Long logId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        GuestMessageLog logEntry = queryService.findLogForOrganization(logId, orgId).orElse(null);

        if (logEntry == null) {
            return ResponseEntity.notFound().build();
        }

        GuestMessageLog newLog = messagingService.sendMessage(
            logEntry.getReservationId(), logEntry.getTemplateId(), orgId);
        return ResponseEntity.ok(GuestMessageLogDto.fromEntity(newLog));
    }

    // ── Apercu du contenu d'un message ──

    @GetMapping("/preview/{logId}")
    public ResponseEntity<Map<String, String>> previewMessage(@PathVariable Long logId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        GuestMessageLog logEntry = queryService.findLogForOrganization(logId, orgId).orElse(null);

        if (logEntry == null || logEntry.getTemplateId() == null) {
            return ResponseEntity.notFound().build();
        }

        try {
            var interpolated = messagingService.previewMessage(
                logEntry.getReservationId(), logEntry.getTemplateId(), orgId);
            return ResponseEntity.ok(Map.of(
                "subject", interpolated.subject(),
                "htmlBody", interpolated.htmlBody()
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                "subject", logEntry.getSubject() != null ? logEntry.getSubject() : "",
                "htmlBody", "<p>Apercu indisponible : " + e.getMessage() + "</p>"
            ));
        }
    }

    // ── Historique ──

    @GetMapping("/history")
    public List<GuestMessageLogDto> getHistory() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return queryService.getHistory(orgId).stream()
            .map(GuestMessageLogDto::fromEntity)
            .toList();
    }

    @GetMapping("/history/reservation/{reservationId}")
    public List<GuestMessageLogDto> getReservationHistory(@PathVariable Long reservationId) {
        // Org du requester (null = platform staff, lecture cross-org autorisee).
        Long orgId = tenantContext.isSuperAdmin() ? null : tenantContext.getRequiredOrganizationId();
        return queryService.getReservationHistory(reservationId, orgId).stream()
            .map(GuestMessageLogDto::fromEntity)
            .toList();
    }
}
