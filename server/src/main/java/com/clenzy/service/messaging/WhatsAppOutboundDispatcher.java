package com.clenzy.service.messaging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Remise WhatsApp d'un message deja persiste.
 *
 * <p>L'appel a Meta se faisait DANS la transaction de
 * {@code ConversationService.sendOutboundMessage} : la connexion de base restait
 * tenue le temps de l'aller-retour HTTP, et l'expediteur attendait la reponse de
 * Meta avant de voir son propre message. Deux defauts distincts, que ce
 * composant separe.</p>
 *
 * <p>Cette methode est {@code @Async} et n'est declenchee qu'APRES le commit :
 * le message est donc deja en base et visible quand l'appel part. Elle ne porte
 * AUCUNE transaction — c'est tout l'objet de l'extraction. L'enregistrement du
 * resultat, lui, en ouvre une neuve, portee par
 * {@link WhatsAppDeliveryRecorder} : un bean distinct, car appeler une methode
 * {@code @Transactional} de la meme classe ne passe pas par le proxy Spring et
 * la transaction serait silencieusement absente.</p>
 *
 * <p>Le contexte tenant suit le fil grace au {@code ContextPropagatingTaskDecorator}
 * pose sur l'executeur asynchrone.</p>
 */
@Component
public class WhatsAppOutboundDispatcher {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppOutboundDispatcher.class);

    private final WhatsAppChannel whatsAppChannel;
    private final WhatsAppDeliveryRecorder recorder;

    public WhatsAppOutboundDispatcher(WhatsAppChannel whatsAppChannel,
                                      WhatsAppDeliveryRecorder recorder) {
        this.whatsAppChannel = whatsAppChannel;
        this.recorder = recorder;
    }

    /**
     * Envoie le message puis consigne le resultat.
     *
     * @param messageId      identifiant du message deja persiste, relu dans la
     *                       transaction d'enregistrement — on ne transporte pas
     *                       une entite detachee a travers un changement de fil
     * @param conversationId sert uniquement aux traces
     */
    @Async
    public void deliver(Long messageId, Long conversationId, MessageDeliveryRequest request) {
        MessageDeliveryResult result;
        try {
            result = whatsAppChannel.send(request);
        } catch (Exception e) {
            // Un echec de transport ne doit pas laisser le message en « SENT »
            // optimiste : on le marque FAILED comme un refus explicite de Meta.
            log.error("Echec envoi WhatsApp (conv {}) : {}", conversationId, e.getMessage(), e);
            recorder.record(messageId, false, null);
            return;
        }

        if (!result.success()) {
            log.warn("Echec envoi WhatsApp (conv {}) : {}", conversationId, result.errorMessage());
        }
        recorder.record(messageId, result.success(), result.providerMessageId());
    }
}
