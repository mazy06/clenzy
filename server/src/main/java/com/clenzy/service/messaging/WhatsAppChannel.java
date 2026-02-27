package com.clenzy.service.messaging;

import com.clenzy.model.MessageChannelType;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class WhatsAppChannel implements MessageChannel {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppChannel.class);

    private final WhatsAppApiService apiService;
    private final WhatsAppConfigRepository configRepository;
    private final TenantContext tenantContext;

    public WhatsAppChannel(WhatsAppApiService apiService,
                            WhatsAppConfigRepository configRepository,
                            TenantContext tenantContext) {
        this.apiService = apiService;
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

            String messageId = apiService.sendTextMessage(
                config, request.recipientPhone(), request.plainBody());
            return MessageDeliveryResult.success(messageId);
        } catch (Exception e) {
            log.error("Erreur envoi WhatsApp a {}: {}", request.recipientPhone(), e.getMessage());
            return MessageDeliveryResult.failure(e.getMessage());
        }
    }
}
