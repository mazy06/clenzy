package com.clenzy.service;

import com.clenzy.dto.UpdateWhatsAppConfigRequest;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppTemplate;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.repository.WhatsAppTemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Acces a la config WhatsApp GLOBALE (singleton plateforme : la ligne
 * organization_id IS NULL) et aux templates WhatsApp par organisation.
 * Logique deplacee depuis {@code WhatsAppConfigController} (refactor
 * T-ARCH-01 — controller mince).
 *
 * <p>La config globale n'est pas org-scopee : c'est le compte WhatsApp unique
 * de la plateforme (cf. migration 0192). Sa modification est gardee au niveau
 * controller par {@code hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')}.</p>
 */
@Service
public class WhatsAppConfigService {

    private final WhatsAppConfigRepository configRepository;
    private final WhatsAppTemplateRepository templateRepository;

    public WhatsAppConfigService(WhatsAppConfigRepository configRepository,
                                 WhatsAppTemplateRepository templateRepository) {
        this.configRepository = configRepository;
        this.templateRepository = templateRepository;
    }

    @Transactional(readOnly = true)
    public Optional<WhatsAppConfig> getGlobalConfig() {
        return configRepository.findFirstByOrganizationIdIsNull();
    }

    /**
     * Update partiel de la config globale. Cree la ligne globale
     * (organization_id NULL) si elle n'existe pas encore.
     */
    @Transactional
    public WhatsAppConfig updateGlobalConfig(UpdateWhatsAppConfigRequest request) {
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull()
            .orElseGet(() -> {
                WhatsAppConfig c = new WhatsAppConfig();
                c.setOrganizationId(null); // ligne globale (singleton plateforme)
                return c;
            });
        applyPatch(config, request);
        return configRepository.save(config);
    }

    /**
     * Merge selectif : seuls les champs non-null du patch sont appliques.
     * Provider strategy : quand l'org bascule META &harr; OPENWA, on conserve
     * les champs de l'ancien provider en base (revenir en arriere sans
     * re-saisir le token). Le resolver n'utilise que ceux du provider actif.
     */
    private void applyPatch(WhatsAppConfig config, UpdateWhatsAppConfigRequest request) {
        if (request.provider() != null) config.setProvider(request.provider());

        // Meta Cloud API
        if (request.apiToken() != null) config.setApiToken(request.apiToken());
        if (request.phoneNumberId() != null) config.setPhoneNumberId(request.phoneNumberId());
        if (request.businessAccountId() != null) config.setBusinessAccountId(request.businessAccountId());
        if (request.webhookVerifyToken() != null) config.setWebhookVerifyToken(request.webhookVerifyToken());

        // OpenWA self-hosted
        if (request.openwaSessionId() != null) config.setOpenwaSessionId(request.openwaSessionId());
        if (request.openwaApiKey() != null) config.setOpenwaApiKey(request.openwaApiKey());

        if (request.enabled() != null) config.setEnabled(request.enabled());
    }

    @Transactional(readOnly = true)
    public List<WhatsAppTemplate> getTemplates(Long organizationId) {
        return templateRepository.findByOrganizationId(organizationId);
    }
}
