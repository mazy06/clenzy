package com.clenzy.controller;

import com.clenzy.service.OrgIntegrationConfigService;
import com.clenzy.service.signature.SignatureProviderType;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Controller pour la configuration cross-provider des integrations de l'organisation.
 *
 * Stocke le CHOIX (radio button cote UI) du provider actif pour chaque type
 * de service (signature, et plus tard facturation client, facturation
 * fournisseur, comptabilite generale).
 *
 * Endpoints :
 *   - GET /api/integrations/config              → la config actuelle de l'org
 *   - PUT /api/integrations/signature-provider  → met a jour le choix signature
 *
 * Securite : @PreAuthorize("isAuthenticated()") + verification orgId via TenantContext
 * (dans {@link OrgIntegrationConfigService}).
 */
@RestController
@RequestMapping("/api/integrations")
@PreAuthorize("isAuthenticated()")
public class IntegrationsConfigController {

    private final OrgIntegrationConfigService orgIntegrationConfigService;

    public IntegrationsConfigController(OrgIntegrationConfigService orgIntegrationConfigService) {
        this.orgIntegrationConfigService = orgIntegrationConfigService;
    }

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        Map<String, Object> body = new HashMap<>();
        body.put("signatureProvider", orgIntegrationConfigService.getSignatureProvider());
        return ResponseEntity.ok(body);
    }

    /**
     * Met a jour le provider actif pour la signature electronique.
     * Body : { "provider": "PENNYLANE" | "ODOO" | null }
     * null = desactive la signature pour cette organisation.
     */
    @PutMapping("/signature-provider")
    public ResponseEntity<Map<String, Object>> setSignatureProvider(@RequestBody UpdateSignatureProviderRequest req) {
        SignatureProviderType provider = req == null ? null : req.provider();

        Map<String, Object> body = new HashMap<>();
        body.put("signatureProvider", orgIntegrationConfigService.setSignatureProvider(provider));
        return ResponseEntity.ok(body);
    }

    /** Body record pour PUT /signature-provider. */
    public record UpdateSignatureProviderRequest(
            @NotNull SignatureProviderType provider
    ) {
    }
}
