package com.clenzy.service;

import com.clenzy.dto.ContactMessageDto;
import com.clenzy.dto.ContactMessageEvent;
import com.clenzy.model.ContactMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Publie les evenements de messages de contact en temps reel via WebSocket (STOMP).
 *
 * Destinations :
 * - /user/{keycloakId}/queue/contact-messages : queue personnelle (expediteur + destinataire)
 * - /topic/contact/{orgId} : broadcast organisation (rafraichir liste de threads)
 *
 * Pattern identique a {@link com.clenzy.service.messaging.ConversationEventPublisher}.
 */
@Service
public class ContactMessageEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(ContactMessageEventPublisher.class);

    private final SimpMessagingTemplate messagingTemplate;

    public ContactMessageEventPublisher(ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider) {
        this.messagingTemplate = messagingTemplateProvider.getIfAvailable();
    }

    /**
     * Publie un nouveau message vers les queues personnelles de l'expediteur et du destinataire,
     * ainsi qu'un broadcast au niveau de l'organisation.
     */
    public void publishNewMessage(ContactMessage msg, ContactMessageDto dto) {
        if (messagingTemplate == null) {
            log.debug("WebSocket non configure, evenement contact non publie");
            return;
        }

        try {
            Long orgId = msg.getOrganizationId();
            ContactMessageEvent event = new ContactMessageEvent(
                    "NEW_MESSAGE",
                    msg.getId(),
                    msg.getSenderKeycloakId(),
                    msg.getRecipientKeycloakId(),
                    orgId,
                    dto
            );

            // Push vers le destinataire (queue personnelle)
            if (msg.getRecipientKeycloakId() != null && !"external".equals(msg.getRecipientKeycloakId())) {
                messagingTemplate.convertAndSendToUser(
                        msg.getRecipientKeycloakId(),
                        "/queue/contact-messages",
                        event
                );
                log.debug("Evenement contact publie vers destinataire {}", msg.getRecipientKeycloakId());
            }

            // Push vers l'expediteur (confirmation, pour les autres onglets/appareils)
            messagingTemplate.convertAndSendToUser(
                    msg.getSenderKeycloakId(),
                    "/queue/contact-messages",
                    event
            );
            log.debug("Evenement contact publie vers expediteur {}", msg.getSenderKeycloakId());

            // Broadcast au niveau org (pour rafraichir la liste de threads des autres utilisateurs)
            messagingTemplate.convertAndSend(
                    "/topic/contact/" + orgId,
                    event
            );
            log.debug("Evenement contact broadcast sur /topic/contact/{}", orgId);

        } catch (Exception e) {
            log.warn("Erreur publication WebSocket contact: {}", e.getMessage());
        }
    }

    /**
     * Notifie l'expediteur que ses messages dans un thread ont ete lus par le destinataire.
     */
    public void publishThreadRead(String readerKeycloakId, String counterpartKeycloakId,
                                   Long orgId, int count) {
        if (messagingTemplate == null) {
            log.debug("WebSocket non configure, evenement THREAD_READ non publie");
            return;
        }

        try {
            ContactMessageEvent event = new ContactMessageEvent(
                    "THREAD_READ",
                    null,
                    readerKeycloakId,
                    counterpartKeycloakId,
                    orgId,
                    null
            );

            // Notifier l'expediteur (counterpart) que ses messages ont ete lus
            messagingTemplate.convertAndSendToUser(
                    counterpartKeycloakId,
                    "/queue/contact-messages",
                    event
            );
            log.debug("Evenement THREAD_READ publie vers {} ({} messages)", counterpartKeycloakId, count);

        } catch (Exception e) {
            log.warn("Erreur publication WebSocket THREAD_READ: {}", e.getMessage());
        }
    }
}
