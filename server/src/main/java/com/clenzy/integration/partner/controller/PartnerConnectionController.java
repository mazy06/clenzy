package com.clenzy.integration.partner.controller;

import com.clenzy.integration.partner.dto.PartnerConnectionRequest;
import com.clenzy.integration.partner.dto.PartnerConnectionStatusDto;
import com.clenzy.integration.partner.model.PartnerServiceConnection;
import com.clenzy.integration.partner.model.PartnerServiceType;
import com.clenzy.integration.partner.service.PartnerServiceConnectionService;
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
 * Connexions aux services partenaires du catalogue Integrations (marketing/CRM,
 * menage, avis, fiscalite, assurance). Routes :
 * <ul>
 *   <li>POST   /api/integrations/partner/{providerType}/connect</li>
 *   <li>GET    /api/integrations/partner/{providerType}/status</li>
 *   <li>POST   /api/integrations/partner/{providerType}/disconnect</li>
 * </ul>
 *
 * <p><b>Scaffolding honnête</b> : la connexion valide la forme des credentials
 * (via Bean Validation sur {@link PartnerConnectionRequest}) et les stocke
 * chiffrées — <b>aucun appel API n'est encore effectué</b>. Les tests de
 * connexion réels et les flux métier seront branchés provider par provider
 * (même trajectoire que Chekin pour la conformité).</p>
 */
@RestController
@RequestMapping("/api/integrations/partner")
@PreAuthorize("isAuthenticated()")
public class PartnerConnectionController {

    private static final Logger log = LoggerFactory.getLogger(PartnerConnectionController.class);

    private final PartnerServiceConnectionService service;
    private final TenantContext tenantContext;

    public PartnerConnectionController(PartnerServiceConnectionService service,
                                       TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    @PostMapping("/{providerType}/connect")
    public ResponseEntity<PartnerConnectionStatusDto> connect(@PathVariable PartnerServiceType providerType,
                                                              @Valid @RequestBody PartnerConnectionRequest request,
                                                              @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = getUserId(jwt);

        log.info("Partner connect: org={} provider={} server={}", orgId, providerType, request.serverUrl());

        PartnerServiceConnection conn = service.saveConnection(
                orgId, userId, providerType,
                request.serverUrl(),
                request.accountIdentifier(),
                request.apiKey()
        );
        return ResponseEntity.ok(PartnerConnectionStatusDto.fromEntity(conn));
    }

    @GetMapping("/{providerType}/status")
    public ResponseEntity<PartnerConnectionStatusDto> status(@PathVariable PartnerServiceType providerType) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<PartnerServiceConnection> conn = service.getConnection(orgId, providerType);
        return ResponseEntity.ok(conn.map(PartnerConnectionStatusDto::fromEntity)
                .orElseGet(() -> PartnerConnectionStatusDto.notConnected(providerType)));
    }

    @PostMapping("/{providerType}/disconnect")
    public ResponseEntity<Map<String, Object>> disconnect(@PathVariable PartnerServiceType providerType) {
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
