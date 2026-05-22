package com.clenzy.integration.channelmanager.controller;

import com.clenzy.integration.channelmanager.dto.ChannelManagerConnectionRequest;
import com.clenzy.integration.channelmanager.dto.ChannelManagerConnectionStatusDto;
import com.clenzy.integration.channelmanager.model.ChannelManagerConnection;
import com.clenzy.integration.channelmanager.model.ChannelManagerProviderType;
import com.clenzy.integration.channelmanager.service.ChannelManagerConnectionService;
import com.clenzy.integration.channelmanager.strategy.ChannelManagerConnectionTestStrategy;
import com.clenzy.integration.channelmanager.strategy.ChannelManagerConnectionTestStrategyRegistry;
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

/** Routes /api/integrations/channel-manager/{providerType}/{connect,status,disconnect}. */
@RestController
@RequestMapping("/api/integrations/channel-manager")
@PreAuthorize("isAuthenticated()")
public class ChannelManagerConnectionController {

    private static final Logger log = LoggerFactory.getLogger(ChannelManagerConnectionController.class);

    private final ChannelManagerConnectionService service;
    private final ChannelManagerConnectionTestStrategyRegistry strategyRegistry;
    private final TenantContext tenantContext;

    public ChannelManagerConnectionController(ChannelManagerConnectionService service,
                                                 ChannelManagerConnectionTestStrategyRegistry strategyRegistry,
                                                 TenantContext tenantContext) {
        this.service = service;
        this.strategyRegistry = strategyRegistry;
        this.tenantContext = tenantContext;
    }

    @PostMapping("/{providerType}/connect")
    public ResponseEntity<?> connect(@PathVariable ChannelManagerProviderType providerType,
                                       @Valid @RequestBody ChannelManagerConnectionRequest request,
                                       @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = getUserId(jwt);

        log.info("ChannelManager connect: org={} provider={} server={}", orgId, providerType, request.serverUrl());

        ChannelManagerConnectionTestStrategy strategy = strategyRegistry.findFor(providerType)
                .orElseThrow(() -> new IllegalStateException(
                        "No ChannelManagerConnectionTestStrategy registered for " + providerType));

        boolean ok = strategy.testConnection(
                request.serverUrl(), request.accountIdentifier(), request.apiKey());
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "connection_failed",
                    "message", "Impossible de se connecter au provider avec ces credentials."
            ));
        }

        ChannelManagerConnection conn = service.saveConnection(
                orgId, userId, providerType,
                request.serverUrl(),
                request.accountIdentifier(),
                request.apiKey()
        );
        return ResponseEntity.ok(ChannelManagerConnectionStatusDto.fromEntity(conn));
    }

    @GetMapping("/{providerType}/status")
    public ResponseEntity<ChannelManagerConnectionStatusDto> status(@PathVariable ChannelManagerProviderType providerType) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<ChannelManagerConnection> conn = service.getConnection(orgId, providerType);
        return ResponseEntity.ok(conn.map(ChannelManagerConnectionStatusDto::fromEntity)
                .orElseGet(() -> ChannelManagerConnectionStatusDto.notConnected(providerType)));
    }

    @PostMapping("/{providerType}/disconnect")
    public ResponseEntity<?> disconnect(@PathVariable ChannelManagerProviderType providerType) {
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
