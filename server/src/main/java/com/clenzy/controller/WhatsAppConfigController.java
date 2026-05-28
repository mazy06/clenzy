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

    @GetMapping("/config")
    public ResponseEntity<WhatsAppConfigDto> getConfig() {
        Long orgId = tenantContext.getOrganizationId();
        return configRepository.findByOrganizationId(orgId)
            .map(WhatsAppConfigDto::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/config")
    public ResponseEntity<WhatsAppConfigDto> updateConfig(@RequestBody UpdateWhatsAppConfigRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        WhatsAppConfig config = configRepository.findByOrganizationId(orgId)
            .orElseGet(() -> {
                WhatsAppConfig c = new WhatsAppConfig();
                c.setOrganizationId(orgId);
                return c;
            });

        // Provider strategy : si l'org bascule de META a OPENWA (ou inverse),
        // on conserve les champs de l'ancien provider en base — utile pour
        // revenir en arriere sans re-saisir le token Meta. Mais le resolver
        // n'utilisera que ceux du provider actif.
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

        config = configRepository.save(config);
        return ResponseEntity.ok(WhatsAppConfigDto.from(config));
    }

    @GetMapping("/templates")
    public ResponseEntity<List<WhatsAppTemplateDto>> getTemplates() {
        Long orgId = tenantContext.getOrganizationId();
        List<WhatsAppTemplateDto> templates = templateRepository.findByOrganizationId(orgId)
            .stream().map(WhatsAppTemplateDto::from).toList();
        return ResponseEntity.ok(templates);
    }
}
