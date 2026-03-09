package com.clenzy.integration.twilio;

import com.clenzy.integration.twilio.config.TwilioConfig;
import com.clenzy.integration.twilio.service.TwilioApiService;
import com.clenzy.model.MessageChannelType;
import com.clenzy.service.messaging.MessageChannel;
import com.clenzy.service.messaging.MessageDeliveryRequest;
import com.clenzy.service.messaging.MessageDeliveryResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Canal SMS via Twilio, implementant l'interface MessageChannel existante.
 * Auto-enregistre dans GuestMessagingService via injection Spring.
 *
 * Prerequis : clenzy.twilio.account-sid doit etre defini.
 */
@Service
@ConditionalOnProperty(name = "clenzy.twilio.account-sid")
public class TwilioSmsChannel implements MessageChannel {

    private static final Logger log = LoggerFactory.getLogger(TwilioSmsChannel.class);

    private final TwilioApiService apiService;
    private final TwilioConfig config;

    public TwilioSmsChannel(TwilioApiService apiService, TwilioConfig config) {
        this.apiService = apiService;
        this.config = config;
    }

    @Override
    public MessageChannelType getChannelType() {
        return MessageChannelType.SMS;
    }

    @Override
    public boolean isAvailable() {
        return config.isConfigured();
    }

    @Override
    public MessageDeliveryResult send(MessageDeliveryRequest request) {
        if (request.recipientPhone() == null || request.recipientPhone().isBlank()) {
            return MessageDeliveryResult.failure("Numero de telephone manquant pour l'envoi SMS");
        }

        try {
            // Construire le message texte (fallback sur htmlBody si plainBody absent)
            String body = request.plainBody();
            if (body == null || body.isBlank()) {
                body = request.htmlBody() != null ? request.htmlBody().replaceAll("<[^>]*>", "") : "";
            }

            String messageSid = apiService.sendSms(request.recipientPhone(), body);
            return MessageDeliveryResult.success(messageSid);
        } catch (Exception e) {
            log.error("Erreur envoi SMS Twilio a {}: {}", request.recipientPhone(), e.getMessage());
            return MessageDeliveryResult.failure(e.getMessage());
        }
    }
}
