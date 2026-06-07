package com.clenzy.controller;

import com.clenzy.dto.UpdateWhatsAppConfigRequest;
import com.clenzy.dto.WhatsAppConfigDto;
import com.clenzy.dto.WhatsAppTemplateDto;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.repository.WhatsAppTemplateRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/whatsapp")
@PreAuthorize("isAuthenticated()")
public class WhatsAppConfigController {

    private final WhatsAppConfigRepository configRepository;
    private final WhatsAppTemplateRepository templateRepository;
    private final TenantContext tenantContext;

    public WhatsAppConfigController(WhatsAppConfigRepository configRepository,
                                     WhatsAppTemplateRepository templateRepository,
                                     TenantContext tenantContext) {
        this.configRepository = configRepository;
        this.templateRepository = templateRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Lecture de la config WhatsApp GLOBALE (singleton plateforme : le compte
     * WhatsApp Baitly unique = la ligne organization_id IS NULL). Accessible a
     * tout utilisateur authentifie (HOST inclus) pour le bandeau de statut
     * read-only. Aucun secret n'est expose (cf. {@link WhatsAppConfigDto}).
     */
    @GetMapping("/config")
    public ResponseEntity<WhatsAppConfigDto> getConfig() {
        return configRepository.findFirstByOrganizationIdIsNull()
            .map(WhatsAppConfigDto::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Update partiel de la config WhatsApp GLOBALE. Reserve a la plateforme :
     * c'est elle qui gere le compte WhatsApp Baitly unique. Cree la ligne
     * globale (organization_id NULL) si elle n'existe pas encore.
     */
    @PutMapping("/config")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<WhatsAppConfigDto> updateConfig(@RequestBody UpdateWhatsAppConfigRequest request) {
        WhatsAppConfig config = configRepository.findFirstByOrganizationIdIsNull()
            .orElseGet(() -> {
                WhatsAppConfig c = new WhatsAppConfig();
                c.setOrganizationId(null); // ligne globale (singleton plateforme)
                return c;
            });
        applyPatch(config, request);
        config = configRepository.save(config);
        return ResponseEntity.ok(WhatsAppConfigDto.from(config));
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

    @GetMapping("/templates")
    public ResponseEntity<List<WhatsAppTemplateDto>> getTemplates() {
        Long orgId = tenantContext.getOrganizationId();
        List<WhatsAppTemplateDto> templates = templateRepository.findByOrganizationId(orgId)
            .stream().map(WhatsAppTemplateDto::from).toList();
        return ResponseEntity.ok(templates);
    }
}
