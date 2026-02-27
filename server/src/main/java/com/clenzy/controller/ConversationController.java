package com.clenzy.controller;

import com.clenzy.dto.ConversationDto;
import com.clenzy.dto.ConversationMessageDto;
import com.clenzy.dto.SendConversationMessageRequest;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationMessage;
import com.clenzy.model.ConversationStatus;
import com.clenzy.service.messaging.ConversationService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final ConversationService conversationService;
    private final TenantContext tenantContext;

    public ConversationController(ConversationService conversationService, TenantContext tenantContext) {
        this.conversationService = conversationService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<Page<ConversationDto>> getInbox(
            @RequestParam(required = false) ConversationStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long orgId = tenantContext.getOrganizationId();
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
        Page<ConversationDto> result = conversationService.getInbox(orgId, status, pageable)
            .map(ConversationDto::from);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/mine")
    public ResponseEntity<Page<ConversationDto>> getMyConversations(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long orgId = tenantContext.getOrganizationId();
        String keycloakId = jwt.getSubject();
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
        Page<ConversationDto> result = conversationService.getMyConversations(orgId, keycloakId, pageable)
            .map(ConversationDto::from);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConversationDto> getById(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return conversationService.getById(id, orgId)
            .map(ConversationDto::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/messages")
    public ResponseEntity<Page<ConversationMessageDto>> getMessages(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Long orgId = tenantContext.getOrganizationId();
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        Page<ConversationMessageDto> result = conversationService.getMessages(id, orgId, pageable)
            .map(ConversationMessageDto::from);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<ConversationMessageDto> sendMessage(
            @PathVariable Long id,
            @Valid @RequestBody SendConversationMessageRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getOrganizationId();
        Conversation conv = conversationService.getById(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Conversation introuvable: " + id));

        String senderName = jwt.getClaimAsString("name");
        if (senderName == null) senderName = jwt.getClaimAsString("preferred_username");

        ConversationMessage msg = conversationService.sendOutboundMessage(
            conv, senderName, jwt.getSubject(), request.content(), request.contentHtml());
        return ResponseEntity.ok(ConversationMessageDto.from(msg));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        conversationService.markAsRead(id, orgId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/assign")
    public ResponseEntity<ConversationDto> assign(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        Long orgId = tenantContext.getOrganizationId();
        String keycloakId = body.get("keycloakId");
        Conversation conv = conversationService.assignConversation(id, orgId, keycloakId);
        return ResponseEntity.ok(ConversationDto.from(conv));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ConversationDto> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        Long orgId = tenantContext.getOrganizationId();
        ConversationStatus status = ConversationStatus.valueOf(body.get("status"));
        Conversation conv = conversationService.updateStatus(id, orgId, status);
        return ResponseEntity.ok(ConversationDto.from(conv));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        Long orgId = tenantContext.getOrganizationId();
        long count = conversationService.getUnreadCount(orgId);
        return ResponseEntity.ok(Map.of("count", count));
    }
}
