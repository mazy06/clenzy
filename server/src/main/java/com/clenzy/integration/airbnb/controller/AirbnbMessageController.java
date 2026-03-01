package com.clenzy.integration.airbnb.controller;

import com.clenzy.integration.airbnb.dto.AirbnbMessageDto;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller REST pour les messages Airbnb.
 *
 * Expose les messages de la messagerie unifiee filtres par channel AIRBNB.
 * Les messages sont ingeres via Kafka (AirbnbMessageService) et stockes
 * dans la table conversation_messages.
 */
@RestController
@RequestMapping("/api/airbnb/messages")
@PreAuthorize("isAuthenticated()")
@Tag(name = "Airbnb Messages", description = "Messages Airbnb (inbox unifie)")
public class AirbnbMessageController {

    private final ConversationMessageRepository messageRepository;
    private final TenantContext tenantContext;

    public AirbnbMessageController(ConversationMessageRepository messageRepository,
                                   TenantContext tenantContext) {
        this.messageRepository = messageRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Lister les messages Airbnb de l'organisation")
    public ResponseEntity<List<AirbnbMessageDto>> getMessages(
            @RequestParam(required = false) String reservationId) {

        Long orgId = tenantContext.getOrganizationId();
        List<ConversationMessage> messages = messageRepository
                .findByOrgAndChannelWithConversation(orgId, ConversationChannel.AIRBNB);

        List<AirbnbMessageDto> dtos = messages.stream()
                .filter(m -> reservationId == null || matchesReservation(m, reservationId))
                .map(this::toDto)
                .toList();

        return ResponseEntity.ok(dtos);
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    private AirbnbMessageDto toDto(ConversationMessage msg) {
        AirbnbMessageDto dto = new AirbnbMessageDto();
        dto.setId(msg.getExternalMessageId() != null ? msg.getExternalMessageId() : String.valueOf(msg.getId()));
        dto.setContent(msg.getContent());
        dto.setSenderName(msg.getSenderName());
        dto.setSenderRole(msg.getDirection().name().equals("INBOUND") ? "guest" : "host");
        dto.setSentAt(msg.getSentAt());
        dto.setRead(msg.getReadAt() != null);

        // Extract reservationId and threadId from senderIdentifier (format: "airbnb:reservation_123")
        String identifier = msg.getSenderIdentifier();
        if (identifier != null && identifier.startsWith("airbnb:")) {
            dto.setReservationId(identifier.substring("airbnb:".length()));
        }

        // Use conversation's externalConversationId as threadId
        if (msg.getConversation() != null) {
            dto.setThreadId(msg.getConversation().getExternalConversationId());
        }

        return dto;
    }

    private boolean matchesReservation(ConversationMessage msg, String reservationId) {
        String identifier = msg.getSenderIdentifier();
        return identifier != null && identifier.contains(reservationId);
    }
}
