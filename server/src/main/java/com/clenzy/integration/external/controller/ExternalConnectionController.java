package com.clenzy.integration.external.controller;

import com.clenzy.integration.external.dto.ExternalConnectionRequest;
import com.clenzy.integration.external.dto.ExternalConnectionStatusDto;
import com.clenzy.integration.external.model.ExternalServiceConnection;
import com.clenzy.integration.external.service.ExternalServiceConnectionService;
import com.clenzy.integration.external.strategy.ConnectionTestStrategy;
import com.clenzy.integration.external.strategy.ConnectionTestStrategyRegistry;
import com.clenzy.service.signature.SignatureProviderRegistry;
import com.clenzy.service.signature.SignatureProviderType;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Controller unifie pour les connexions API key vers les providers de
 * signature electronique (Yousign, Universign, DocaPoste, ...).
 *
 * Pennylane (OAuth2) et DocuSign (OAuth2) ne passent PAS par ce controller —
 * ils ont leurs propres controllers dedies a cause des specificites OAuth.
 *
 * Endpoints :
 *   - POST   /api/integrations/external/{providerType}/connect
 *   - GET    /api/integrations/external/{providerType}/status
 *   - POST   /api/integrations/external/{providerType}/disconnect
 *
 * Securite :
 *   - @PreAuthorize("isAuthenticated()") + verification orgId
 *   - apiKey JAMAIS retournee en clair, jamais loguee
 *   - Validation provider whitelist (refuse PENNYLANE, DOCUSIGN, CLENZY_CUSTOM
 *     qui ont leurs propres flows)
 */
@RestController
@RequestMapping("/api/integrations/external")
@PreAuthorize("isAuthenticated()")
public class ExternalConnectionController {

    private static final Logger log = LoggerFactory.getLogger(ExternalConnectionController.class);

    /**
     * Providers acceptes par ce controller generique. Les autres (PENNYLANE,
     * DOCUSIGN avec OAuth, CLENZY_CUSTOM sans connexion) sont rejetes.
     */
    private static final Set<SignatureProviderType> SUPPORTED_PROVIDERS = EnumSet.of(
            SignatureProviderType.YOUSIGN,
            SignatureProviderType.UNIVERSIGN,
            SignatureProviderType.DOCAPOSTE,
            SignatureProviderType.ODOO
    );

    private final ExternalServiceConnectionService service;
    private final ConnectionTestStrategyRegistry strategyRegistry;
    private final SignatureProviderRegistry signatureProviderRegistry;
    private final TenantContext tenantContext;

    public ExternalConnectionController(ExternalServiceConnectionService service,
                                          ConnectionTestStrategyRegistry strategyRegistry,
                                          SignatureProviderRegistry signatureProviderRegistry,
                                          TenantContext tenantContext) {
        this.service = service;
        this.strategyRegistry = strategyRegistry;
        this.signatureProviderRegistry = signatureProviderRegistry;
        this.tenantContext = tenantContext;
    }

    /**
     * État des providers de signature enregistrés : disponibilité (configuration /
     * connexion org) et provider actif ({@code SIGNATURE_PROVIDER}). Alimente la
     * section « Signature électronique » de l'onglet Intégrations.
     */
    @GetMapping("/signature-providers")
    public ResponseEntity<List<Map<String, Object>>> signatureProviders() {
        SignatureProviderType active = signatureProviderRegistry.getActiveProviderType();
        List<Map<String, Object>> result = signatureProviderRegistry.getAllProviders().values().stream()
                .map(provider -> {
                    boolean available;
                    try {
                        available = provider.isAvailable();
                    } catch (Exception e) {
                        available = false;
                    }
                    return Map.<String, Object>of(
                            "type", provider.getType().name(),
                            "available", available,
                            "active", provider.getType() == active);
                })
                .sorted(Comparator.comparing(m -> (String) m.get("type")))
                .toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{providerType}/connect")
    public ResponseEntity<?> connect(@PathVariable SignatureProviderType providerType,
                                       @Valid @RequestBody ExternalConnectionRequest request,
                                       @AuthenticationPrincipal Jwt jwt) {
        if (!SUPPORTED_PROVIDERS.contains(providerType)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "unsupported_provider",
                    "message", "Le provider " + providerType + " utilise un autre flux "
                            + "de connexion (OAuth2). Voir /api/" + providerType.name().toLowerCase()
                            + "/connect."
            ));
        }

        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = getUserId(jwt);

        log.info("External connect: org={} provider={} server={}", orgId, providerType, request.serverUrl());

        // Strategy dispatch — chaque provider a sa propre logique de test.
        // Pour les providers stubbes (Yousign/Universign/DocaPoste), la
        // strategie accepte par defaut. Pour Odoo, elle appelle l'API
        // JSON-RPC /web/session/authenticate.
        ConnectionTestStrategy strategy = strategyRegistry.findFor(providerType)
                .orElseThrow(() -> new IllegalStateException(
                        "No ConnectionTestStrategy registered for " + providerType));

        boolean ok = strategy.testConnection(
                request.serverUrl(), request.accountIdentifier(), request.apiKey());

        if (!ok) {
            log.warn("External connect: test failed for org={} provider={}", orgId, providerType);
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "connection_failed",
                    "message", "Impossible de se connecter au provider avec ces credentials."
            ));
        }

        ExternalServiceConnection conn = service.saveConnection(
                orgId, userId, providerType,
                request.serverUrl(),
                request.accountIdentifier(),
                request.apiKey()
        );
        return ResponseEntity.ok(ExternalConnectionStatusDto.fromEntity(conn));
    }

    @GetMapping("/{providerType}/status")
    public ResponseEntity<ExternalConnectionStatusDto> status(@PathVariable SignatureProviderType providerType) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<ExternalServiceConnection> conn = service.getConnection(orgId, providerType);
        return ResponseEntity.ok(conn.map(ExternalConnectionStatusDto::fromEntity)
                .orElseGet(() -> ExternalConnectionStatusDto.notConnected(providerType)));
    }

    @PostMapping("/{providerType}/disconnect")
    public ResponseEntity<?> disconnect(@PathVariable SignatureProviderType providerType) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        boolean deleted = service.disconnect(orgId, providerType);
        Map<String, Object> body = new HashMap<>();
        body.put("disconnected", deleted);
        body.put("provider", providerType);
        return ResponseEntity.ok(body);
    }

    private Long getUserId(Jwt jwt) {
        if (jwt == null) return null;
        Object uid = jwt.getClaim("user_id");
        if (uid instanceof Number n) return n.longValue();
        if (uid instanceof String s) {
            try { return Long.parseLong(s); } catch (NumberFormatException ignored) {}
        }
        return null;
    }
}
