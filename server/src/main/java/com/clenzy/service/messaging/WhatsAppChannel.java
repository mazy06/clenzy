package com.clenzy.service.messaging;

import com.clenzy.model.MessageChannelType;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.service.messaging.whatsapp.WhatsAppProvider;
import com.clenzy.service.messaging.whatsapp.WhatsAppProviderResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Canal d'envoi WhatsApp. Resout dynamiquement le {@link WhatsAppProvider}
 * a utiliser (Meta ou OpenWA) via {@link WhatsAppProviderResolver} en fonction
 * de la config de l'org courante.
 *
 * <p>Le code metier appelant ({@code GuestMessagingService}) reste totalement
 * agnostique du provider — l'isolation passe par l'interface {@code MessageChannel}
 * commune a EmailChannel + WhatsAppChannel.</p>
 */
@Service
public class WhatsAppChannel implements MessageChannel {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppChannel.class);

    private final WhatsAppProviderResolver providerResolver;
    private final WhatsAppConfigRepository configRepository;

    public WhatsAppChannel(WhatsAppProviderResolver providerResolver,
                            WhatsAppConfigRepository configRepository) {
        this.providerResolver = providerResolver;
        this.configRepository = configRepository;
    }

    @Override
    public MessageChannelType getChannelType() {
        return MessageChannelType.WHATSAPP;
    }

    @Override
    public boolean isAvailable() {
        try {
            return configRepository.findFirstByOrganizationIdIsNull()
                .map(WhatsAppConfig::isEnabled)
                .orElse(false);
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public MessageDeliveryResult send(MessageDeliveryRequest request) {
        if (request.recipientPhone() == null || request.recipientPhone().isBlank()) {
            return MessageDeliveryResult.failure("Numero de telephone manquant");
        }

        try {
            WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull()
                .orElseThrow(() -> new IllegalStateException("WhatsApp non configure"));

            if (!config.isEnabled()) {
                return MessageDeliveryResult.failure("WhatsApp desactive (compte global)");
            }

            WhatsAppProvider provider = providerResolver.resolve(config);
            String messageId = provider.sendTextMessage(
                config, request.recipientPhone(), request.plainBody());
            return MessageDeliveryResult.success(messageId);
        } catch (Exception e) {
            log.error("Erreur envoi WhatsApp a {}: {}", request.recipientPhone(), e.getMessage());
            return MessageDeliveryResult.failure(e.getMessage());
        }
    }

    /**
     * Envoie un template WhatsApp. Avec Meta → API template officielle
     * ({@code sendTemplateMessage} avec params positionnels). Avec OpenWA (pas de
     * templates Meta) → fallback automatique sur l'envoi texte du corps rendu
     * ({@code fallbackText}). Bypasse la fenetre 24h (un template approuve, ou un
     * envoi OpenWA, n'y est pas soumis).
     */
    public MessageDeliveryResult sendTemplate(String phone, String metaTemplateName, String language,
                                              List<String> params, String fallbackText) {
        if (phone == null || phone.isBlank()) {
            return MessageDeliveryResult.failure("Numero de telephone manquant");
        }
        try {
            WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull()
                .orElseThrow(() -> new IllegalStateException("WhatsApp non configure"));
            if (!config.isEnabled()) {
                return MessageDeliveryResult.failure("WhatsApp desactive (compte global)");
            }
            WhatsAppProvider provider = providerResolver.resolve(config);
            String messageId;
            try {
                messageId = provider.sendTemplateMessage(config, phone, metaTemplateName, language, params);
            } catch (UnsupportedOperationException unsupported) {
                // OpenWA : pas de templates Meta → on envoie le corps interpole en texte.
                messageId = provider.sendTextMessage(config, phone, fallbackText);
            }
            return MessageDeliveryResult.success(messageId);
        } catch (Exception e) {
            log.error("Erreur envoi template WhatsApp a {}: {}", phone, e.getMessage());
            return MessageDeliveryResult.failure(e.getMessage());
        }
    }
}
