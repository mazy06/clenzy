package com.clenzy.controller;

import com.clenzy.model.OrgIntegrationConfig;
import com.clenzy.repository.OrgIntegrationConfigRepository;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.constraints.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

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
 * Securite : @PreAuthorize("isAuthenticated()") + verification orgId via TenantContext.
 */
@RestController
@RequestMapping("/api/integrations")
@PreAuthorize("isAuthenticated()")
public class IntegrationsConfigController {

    private static final Logger log = LoggerFactory.getLogger(IntegrationsConfigController.class);

    private final OrgIntegrationConfigRepository repository;
    private final TenantContext tenantContext;

    public IntegrationsConfigController(OrgIntegrationConfigRepository repository,
                                          TenantContext tenantContext) {
        this.repository = repository;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<OrgIntegrationConfig> conf = repository.findByOrganizationId(orgId);

        Map<String, Object> body = new HashMap<>();
        body.put("signatureProvider", conf.map(OrgIntegrationConfig::getSignatureProvider).orElse(null));
        return ResponseEntity.ok(body);
    }

    /**
     * Met a jour le provider actif pour la signature electronique.
     * Body : { "provider": "PENNYLANE" | "ODOO" | null }
     * null = desactive la signature pour cette organisation.
     */
    @PutMapping("/signature-provider")
    public ResponseEntity<Map<String, Object>> setSignatureProvider(@RequestBody UpdateSignatureProviderRequest req) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        SignatureProviderType provider = req == null ? null : req.provider();
        log.info("Set signature provider for org {} → {}", orgId, provider);

        OrgIntegrationConfig config = repository.findByOrganizationId(orgId)
                .orElseGet(() -> {
                    OrgIntegrationConfig c = new OrgIntegrationConfig();
                    c.setOrganizationId(orgId);
                    c.setCreatedAt(Instant.now());
                    return c;
                });
        config.setSignatureProvider(provider);
        config.setUpdatedAt(Instant.now());
        repository.save(config);

        Map<String, Object> body = new HashMap<>();
        body.put("signatureProvider", provider);
        return ResponseEntity.ok(body);
    }

    /** Body record pour PUT /signature-provider. */
    public record UpdateSignatureProviderRequest(
            @NotNull SignatureProviderType provider
    ) {
    }
}
