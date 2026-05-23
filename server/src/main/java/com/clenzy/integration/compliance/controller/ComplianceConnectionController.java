package com.clenzy.integration.compliance.controller;

import com.clenzy.integration.compliance.dto.ComplianceConnectionRequest;
import com.clenzy.integration.compliance.dto.ComplianceConnectionStatusDto;
import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.service.ComplianceConnectionService;
import com.clenzy.integration.compliance.strategy.ComplianceConnectionTestStrategy;
import com.clenzy.integration.compliance.strategy.ComplianceConnectionTestStrategyRegistry;
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
 * Controller pour les connexions de conformite legale (declaration voyageurs).
 * Routes :
 * <ul>
 *   <li>POST   /api/integrations/compliance/{providerType}/connect</li>
 *   <li>GET    /api/integrations/compliance/{providerType}/status</li>
 *   <li>POST   /api/integrations/compliance/{providerType}/disconnect</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/integrations/compliance")
@PreAuthorize("isAuthenticated()")
public class ComplianceConnectionController {

    private static final Logger log = LoggerFactory.getLogger(ComplianceConnectionController.class);

    private final ComplianceConnectionService service;
    private final ComplianceConnectionTestStrategyRegistry strategyRegistry;
    private final TenantContext tenantContext;

    public ComplianceConnectionController(ComplianceConnectionService service,
                                            ComplianceConnectionTestStrategyRegistry strategyRegistry,
                                            TenantContext tenantContext) {
        this.service = service;
        this.strategyRegistry = strategyRegistry;
        this.tenantContext = tenantContext;
    }

    @PostMapping("/{providerType}/connect")
    public ResponseEntity<?> connect(@PathVariable ComplianceProviderType providerType,
                                       @Valid @RequestBody ComplianceConnectionRequest request,
                                       @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = getUserId(jwt);

        log.info("Compliance connect: org={} provider={} server={}", orgId, providerType, request.serverUrl());

        ComplianceConnectionTestStrategy strategy = strategyRegistry.findFor(providerType)
                .orElseThrow(() -> new IllegalStateException(
                        "No ComplianceConnectionTestStrategy registered for " + providerType));

        boolean ok = strategy.testConnection(
                request.serverUrl(), request.accountIdentifier(), request.apiKey());
        if (!ok) {
            log.warn("Compliance connect: test failed for org={} provider={}", orgId, providerType);
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "connection_failed",
                    "message", "Impossible de se connecter au provider avec ces credentials."
            ));
        }

        ComplianceConnection conn = service.saveConnection(
                orgId, userId, providerType,
                request.serverUrl(),
                request.accountIdentifier(),
                request.apiKey()
        );
        return ResponseEntity.ok(ComplianceConnectionStatusDto.fromEntity(conn));
    }

    @GetMapping("/{providerType}/status")
    public ResponseEntity<ComplianceConnectionStatusDto> status(@PathVariable ComplianceProviderType providerType) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<ComplianceConnection> conn = service.getConnection(orgId, providerType);
        return ResponseEntity.ok(conn.map(ComplianceConnectionStatusDto::fromEntity)
                .orElseGet(() -> ComplianceConnectionStatusDto.notConnected(providerType)));
    }

    @PostMapping("/{providerType}/disconnect")
    public ResponseEntity<?> disconnect(@PathVariable ComplianceProviderType providerType) {
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
