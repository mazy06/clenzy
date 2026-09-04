package com.clenzy.service.messaging;

import com.clenzy.model.ConversationMessage;
import com.clenzy.repository.ConversationMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consigne l'issue d'une remise WhatsApp.
 *
 * <p>Bean DISTINCT de {@link WhatsAppOutboundDispatcher}, et non une methode de
 * celui-ci : appeler une methode {@code @Transactional} de la meme classe ne
 * passe pas par le proxy Spring, et la transaction serait silencieusement
 * absente — l'ecriture partirait alors en auto-commit, hors de tout contexte
 * tenant.</p>
 *
 * <p>{@code REQUIRES_NEW} parce que l'appel arrive APRES le commit de la
 * transaction d'envoi : il n'y a plus rien a rejoindre, il faut une transaction
 * neuve. Le message est relu par son identifiant plutot que transporte comme
 * entite : celle du fil d'origine serait detachee.</p>
 */
@Component
public class WhatsAppDeliveryRecorder {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppDeliveryRecorder.class);

    private final ConversationMessageRepository messageRepository;
    private final ConversationEventPublisher eventPublisher;

    public WhatsAppDeliveryRecorder(ConversationMessageRepository messageRepository,
                                    ConversationEventPublisher eventPublisher) {
        this.messageRepository = messageRepository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * @param providerMessageId identifiant Meta, absent en cas d'echec
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long messageId, boolean success, String providerMessageId) {
        ConversationMessage message = messageRepository.findById(messageId).orElse(null);
        if (message == null) {
            log.warn("Message {} introuvable a l'enregistrement de la remise WhatsApp", messageId);
            return;
        }

        message.setDeliveryStatus(success ? "SENT" : "FAILED");
        if (providerMessageId != null) {
            message.setExternalMessageId(providerMessageId);
        }
        message = messageRepository.save(message);

        // Le statut change APRES que l'expediteur a recu sa reponse : sans cette
        // publication, un echec resterait affiche « envoye » jusqu'au prochain
        // rechargement de l'ecran.
        if (message.getConversation() != null) {
            eventPublisher.publishNewMessage(message.getConversation(), message);
        }
    }
}
