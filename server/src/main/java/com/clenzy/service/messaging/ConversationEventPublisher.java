package com.clenzy.service.messaging;

import com.clenzy.dto.ConversationMessageDto;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Publie les evenements de conversation en temps reel via WebSocket (STOMP).
 * Envoie vers /topic/conversations/{orgId} pour les clients abonnes.
 */
@Service
public class ConversationEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(ConversationEventPublisher.class);

    private final SimpMessagingTemplate messagingTemplate;

    public ConversationEventPublisher(ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider) {
        this.messagingTemplate = messagingTemplateProvider.getIfAvailable();
    }

    public void publishNewMessage(Conversation conversation, ConversationMessage message) {
        if (messagingTemplate == null) {
            log.debug("WebSocket non configure, evenement non publie");
            return;
        }

        try {
            String destination = "/topic/conversations/" + conversation.getOrganizationId();
            ConversationMessageDto dto = ConversationMessageDto.from(message);
            messagingTemplate.convertAndSend(destination, dto);
            log.debug("Evenement publie sur {}", destination);
        } catch (Exception e) {
            log.warn("Erreur publication WebSocket: {}", e.getMessage());
        }
    }
}
