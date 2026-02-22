package com.clenzy.service.messaging;

import com.clenzy.model.MessageChannelType;

/**
 * Interface pour les canaux d'envoi de messages aux voyageurs.
 * Implementations : EmailChannel (actif), WhatsAppChannel (futur).
 */
public interface MessageChannel {

    MessageChannelType getChannelType();

    MessageDeliveryResult send(MessageDeliveryRequest request);

    boolean isAvailable();
}
