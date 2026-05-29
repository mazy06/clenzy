package com.clenzy.service.messaging;

import com.clenzy.model.MessageChannelType;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.service.messaging.whatsapp.WhatsAppProvider;
import com.clenzy.service.messaging.whatsapp.WhatsAppProviderResolver;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

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
    private final TenantContext tenantContext;

    public WhatsAppChannel(WhatsAppProviderResolver providerResolver,
                            WhatsAppConfigRepository configRepository,
                            TenantContext tenantContext) {
        this.providerResolver = providerResolver;
        this.configRepository = configRepository;
        this.tenantContext = tenantContext;
    }

    @Override
    public MessageChannelType getChannelType() {
        return MessageChannelType.WHATSAPP;
    }

    @Override
    public boolean isAvailable() {
        try {
            Long orgId = tenantContext.getOrganizationId();
            return configRepository.findByOrganizationId(orgId)
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
            Long orgId = tenantContext.getOrganizationId();
            WhatsAppConfig config = configRepository.findByOrganizationId(orgId)
                .orElseThrow(() -> new IllegalStateException("WhatsApp non configure"));

            if (!config.isEnabled()) {
                return MessageDeliveryResult.failure("WhatsApp desactive pour cette organisation");
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
}
