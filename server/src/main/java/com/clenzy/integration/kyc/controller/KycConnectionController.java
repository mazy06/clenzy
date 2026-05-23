package com.clenzy.integration.kyc.controller;

import com.clenzy.integration.kyc.dto.KycConnectionRequest;
import com.clenzy.integration.kyc.dto.KycConnectionStatusDto;
import com.clenzy.integration.kyc.model.KycConnection;
import com.clenzy.integration.kyc.model.KycProviderType;
import com.clenzy.integration.kyc.service.KycConnectionService;
import com.clenzy.integration.kyc.strategy.KycConnectionTestStrategy;
import com.clenzy.integration.kyc.strategy.KycConnectionTestStrategyRegistry;
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

/** Routes /api/integrations/kyc/{providerType}/{connect,status,disconnect}. */
@RestController
@RequestMapping("/api/integrations/kyc")
@PreAuthorize("isAuthenticated()")
public class KycConnectionController {

    private static final Logger log = LoggerFactory.getLogger(KycConnectionController.class);

    private final KycConnectionService service;
    private final KycConnectionTestStrategyRegistry strategyRegistry;
    private final TenantContext tenantContext;

    public KycConnectionController(KycConnectionService service,
                                     KycConnectionTestStrategyRegistry strategyRegistry,
                                     TenantContext tenantContext) {
        this.service = service;
        this.strategyRegistry = strategyRegistry;
        this.tenantContext = tenantContext;
    }

    @PostMapping("/{providerType}/connect")
    public ResponseEntity<?> connect(@PathVariable KycProviderType providerType,
                                       @Valid @RequestBody KycConnectionRequest request,
                                       @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = getUserId(jwt);

        log.info("KYC connect: org={} provider={} server={}", orgId, providerType, request.serverUrl());

        KycConnectionTestStrategy strategy = strategyRegistry.findFor(providerType)
                .orElseThrow(() -> new IllegalStateException(
                        "No KycConnectionTestStrategy registered for " + providerType));

        boolean ok = strategy.testConnection(
                request.serverUrl(), request.accountIdentifier(), request.apiKey());
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "connection_failed",
                    "message", "Impossible de se connecter au provider avec ces credentials."
            ));
        }

        KycConnection conn = service.saveConnection(
                orgId, userId, providerType,
                request.serverUrl(),
                request.accountIdentifier(),
                request.apiKey()
        );
        return ResponseEntity.ok(KycConnectionStatusDto.fromEntity(conn));
    }

    @GetMapping("/{providerType}/status")
    public ResponseEntity<KycConnectionStatusDto> status(@PathVariable KycProviderType providerType) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<KycConnection> conn = service.getConnection(orgId, providerType);
        return ResponseEntity.ok(conn.map(KycConnectionStatusDto::fromEntity)
                .orElseGet(() -> KycConnectionStatusDto.notConnected(providerType)));
    }

    @PostMapping("/{providerType}/disconnect")
    public ResponseEntity<?> disconnect(@PathVariable KycProviderType providerType) {
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
