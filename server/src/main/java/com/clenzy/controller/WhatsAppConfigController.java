package com.clenzy.controller;

import com.clenzy.dto.UpdateWhatsAppConfigRequest;
import com.clenzy.dto.WhatsAppConfigDto;
import com.clenzy.dto.WhatsAppTemplateDto;
import com.clenzy.service.WhatsAppConfigService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/whatsapp")
@PreAuthorize("isAuthenticated()")
public class WhatsAppConfigController {

    private final WhatsAppConfigService configService;
    private final TenantContext tenantContext;

    public WhatsAppConfigController(WhatsAppConfigService configService,
                                     TenantContext tenantContext) {
        this.configService = configService;
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
        return configService.getGlobalConfig()
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
        return ResponseEntity.ok(WhatsAppConfigDto.from(configService.updateGlobalConfig(request)));
    }

    @GetMapping("/templates")
    public ResponseEntity<List<WhatsAppTemplateDto>> getTemplates() {
        Long orgId = tenantContext.getOrganizationId();
        List<WhatsAppTemplateDto> templates = configService.getTemplates(orgId)
            .stream().map(WhatsAppTemplateDto::from).toList();
        return ResponseEntity.ok(templates);
    }
}
