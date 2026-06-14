package com.clenzy.controller;

import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.dto.ConversationDto;
import com.clenzy.dto.ConversationMessageDto;
import com.clenzy.dto.SendConversationMessageRequest;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import com.clenzy.model.ConversationStatus;
import com.clenzy.service.messaging.ConversationAiAssistService;
import com.clenzy.service.messaging.ConversationService;
import com.clenzy.service.messaging.WhatsAppTemplateSender;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conversations")
@PreAuthorize("isAuthenticated()")
public class ConversationController {

    private final ConversationService conversationService;
    private final WhatsAppTemplateSender whatsAppTemplateSender;
    private final ConversationAiAssistService aiAssistService;
    private final TenantContext tenantContext;

    public ConversationController(ConversationService conversationService,
                                  WhatsAppTemplateSender whatsAppTemplateSender,
                                  ConversationAiAssistService aiAssistService,
                                  TenantContext tenantContext) {
        this.conversationService = conversationService;
        this.whatsAppTemplateSender = whatsAppTemplateSender;
        this.aiAssistService = aiAssistService;
        this.tenantContext = tenantContext;
    }

    /**
     * Copilote IA (CLZ Domaine 6) : génère un brouillon de réponse ancré sur le dernier message
     * du voyageur + la base de connaissances (RAG). N'envoie rien.
     */
    @PostMapping("/{id}/suggest-reply")
    public ResponseEntity<AiSuggestedResponseDto> suggestReply(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(aiAssistService.suggestReply(orgId, id));
    }

    @GetMapping
    public ResponseEntity<Page<ConversationDto>> getInbox(
            @RequestParam(required = false) ConversationStatus status,
            @RequestParam(required = false) List<ConversationChannel> channels,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long orgId = tenantContext.getOrganizationId();
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
        Page<Conversation> conversations;
        if (channels != null && !channels.isEmpty()) {
            conversations = conversationService.getInboxByChannels(orgId, channels, status, pageable);
        } else {
            conversations = conversationService.getInbox(orgId, status, pageable);
        }
        return ResponseEntity.ok(conversations.map(ConversationDto::from));
    }

    /**
     * Rattache une conversation « à trier » à une réservation (relais WhatsApp).
     * Réservé aux platform staff qui gèrent la file « à trier ». Body :
     * {@code { reservationId: number, memorizePhone?: boolean }}.
     */
    @PutMapping("/{id}/attach")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<ConversationDto> attach(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Object resIdRaw = body.get("reservationId");
        if (!(resIdRaw instanceof Number)) {
            return ResponseEntity.badRequest().build();
        }
        Long reservationId = ((Number) resIdRaw).longValue();
        boolean memorizePhone = !Boolean.FALSE.equals(body.get("memorizePhone"));
        return ResponseEntity.ok(conversationService.attachToReservation(id, reservationId, memorizePhone));
    }

    /**
     * Envoie un template WhatsApp sur la conversation (relance, code d'accès, etc.).
     * Body : {@code { templateKey: "checkin_instructions" }}. Fonctionne dans et
     * hors fenêtre 24h (un template n'y est pas soumis).
     */
    @PostMapping("/{id}/send-template")
    public ResponseEntity<ConversationDto> sendTemplate(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        String templateKey = body.get("templateKey");
        if (templateKey == null || templateKey.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String senderName = jwt.getClaimAsString("name");
        if (senderName == null) senderName = jwt.getClaimAsString("preferred_username");
        return ResponseEntity.ok(whatsAppTemplateSender.sendTemplate(id, templateKey, senderName, jwt.getSubject()));
    }

    /**
     * Envoi PROACTIF d'un template WhatsApp depuis une réservation (crée la
     * conversation au besoin). Body : {@code { templateKey: "checkin_instructions" }}.
     */
    @PostMapping("/reservation/{reservationId}/send-template")
    public ResponseEntity<ConversationDto> sendTemplateForReservation(
            @PathVariable Long reservationId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        String templateKey = body.get("templateKey");
        if (templateKey == null || templateKey.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String senderName = jwt.getClaimAsString("name");
        if (senderName == null) senderName = jwt.getClaimAsString("preferred_username");
        return ResponseEntity.ok(whatsAppTemplateSender.sendTemplateForReservation(
            reservationId, templateKey, senderName, jwt.getSubject()));
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
