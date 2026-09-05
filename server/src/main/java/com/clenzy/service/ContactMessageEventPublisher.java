package com.clenzy.service;

import com.clenzy.dto.ContactMessageDto;
import com.clenzy.dto.ContactMessageEvent;
import com.clenzy.model.ContactMessage;
import java.util.Collection;

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

            broadcastRefreshSignal(orgId, msg.getId());

        } catch (Exception e) {
            log.warn("Erreur publication WebSocket contact: {}", e.getMessage());
        }
    }

    /**
     * Publie un message de fil de GROUPE aux seuls participants.
     *
     * <p>Le contenu ne part que dans les files personnelles des participants.
     * Le diffuser sur le sujet d'organisation le rendait lisible par tout
     * membre abonne, participant ou non : le filtrage ne tenait alors qu'a la
     * bonne volonte du client, ce qui n'est pas un controle d'acces.</p>
     *
     * @param participantKeycloakIds participants du fil, expediteur inclus —
     *                               il a d'autres onglets et d'autres appareils
     */
    public void publishToParticipants(ContactMessage msg, ContactMessageDto dto,
                                      Collection<String> participantKeycloakIds) {
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

            for (String keycloakId : participantKeycloakIds) {
                if (keycloakId == null || keycloakId.isBlank() || "external".equals(keycloakId)) {
                    continue;
                }
                messagingTemplate.convertAndSendToUser(keycloakId, "/queue/contact-messages", event);
            }
            log.debug("Evenement contact publie a {} participant(s) du fil {}",
                    participantKeycloakIds.size(), msg.getThreadId());

            broadcastRefreshSignal(orgId, msg.getId());

        } catch (Exception e) {
            log.warn("Erreur publication WebSocket contact: {}", e.getMessage());
        }
    }

    /**
     * Signal SANS CONTENU sur le sujet d'organisation.
     *
     * <p>Il ne sert qu'a faire rafraichir la liste des fils : les compteurs de
     * non-lus et l'ordre changent pour tout le monde. Le message lui-meme n'y
     * figure pas — l'endpoint qui sert la liste applique, lui, les droits.</p>
     */
    private void broadcastRefreshSignal(Long orgId, Long messageId) {
        messagingTemplate.convertAndSend(
                "/topic/contact/" + orgId,
                new ContactMessageEvent("REFRESH", messageId, null, null, orgId, null)
        );
        log.debug("Signal de rafraichissement diffuse sur /topic/contact/{}", orgId);
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
