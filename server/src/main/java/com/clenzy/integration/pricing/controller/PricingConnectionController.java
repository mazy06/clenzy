package com.clenzy.integration.pricing.controller;

import com.clenzy.integration.pricing.dto.PricingConnectionRequest;
import com.clenzy.integration.pricing.dto.PricingConnectionStatusDto;
import com.clenzy.integration.pricing.model.PricingConnection;
import com.clenzy.integration.pricing.model.PricingProviderType;
import com.clenzy.integration.pricing.service.PricingConnectionService;
import com.clenzy.integration.pricing.strategy.PricingConnectionTestStrategy;
import com.clenzy.integration.pricing.strategy.PricingConnectionTestStrategyRegistry;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Controller pour les connexions API key vers les providers de tarification
 * dynamique (PriceLabs, Beyond). Routes :
 * <ul>
 *   <li>POST   /api/integrations/pricing/{providerType}/connect</li>
 *   <li>GET    /api/integrations/pricing/{providerType}/status</li>
 *   <li>POST   /api/integrations/pricing/{providerType}/disconnect</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/integrations/pricing")
@PreAuthorize("isAuthenticated()")
public class PricingConnectionController {

    private static final Logger log = LoggerFactory.getLogger(PricingConnectionController.class);

    private final PricingConnectionService service;
    private final PricingConnectionTestStrategyRegistry strategyRegistry;
    private final TenantContext tenantContext;

    public PricingConnectionController(PricingConnectionService service,
                                          PricingConnectionTestStrategyRegistry strategyRegistry,
                                          TenantContext tenantContext) {
        this.service = service;
        this.strategyRegistry = strategyRegistry;
        this.tenantContext = tenantContext;
    }

    @PostMapping("/{providerType}/connect")
    public ResponseEntity<?> connect(@PathVariable PricingProviderType providerType,
                                       @Valid @RequestBody PricingConnectionRequest request,
                                       @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = getUserId(jwt);

        log.info("Pricing connect: org={} provider={} server={}", orgId, providerType, request.serverUrl());

        PricingConnectionTestStrategy strategy = strategyRegistry.findFor(providerType)
                .orElseThrow(() -> new IllegalStateException(
                        "No PricingConnectionTestStrategy registered for " + providerType));

        boolean ok = strategy.testConnection(
                request.serverUrl(), request.accountIdentifier(), request.apiKey());
        if (!ok) {
            log.warn("Pricing connect: test failed for org={} provider={}", orgId, providerType);
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "connection_failed",
                    "message", "Impossible de se connecter au provider avec ces credentials."
            ));
        }

        PricingConnection conn = service.saveConnection(
                orgId, userId, providerType,
                request.serverUrl(),
                request.accountIdentifier(),
                request.apiKey()
        );
        return ResponseEntity.ok(PricingConnectionStatusDto.fromEntity(conn));
    }

    @GetMapping("/{providerType}/status")
    public ResponseEntity<PricingConnectionStatusDto> status(@PathVariable PricingProviderType providerType) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<PricingConnection> conn = service.getConnection(orgId, providerType);
        return ResponseEntity.ok(conn.map(PricingConnectionStatusDto::fromEntity)
                .orElseGet(() -> PricingConnectionStatusDto.notConnected(providerType)));
    }

    @PostMapping("/{providerType}/disconnect")
    public ResponseEntity<?> disconnect(@PathVariable PricingProviderType providerType) {
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
