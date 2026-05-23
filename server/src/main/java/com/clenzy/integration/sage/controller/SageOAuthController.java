package com.clenzy.integration.sage.controller;

import com.clenzy.integration.oauth.OAuthStateService;
import com.clenzy.integration.sage.model.SageConnection;
import com.clenzy.integration.sage.service.SageOAuthService;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Controller OAuth2 Sage Business Cloud Accounting.
 * Routes /api/sage/{connect,callback,status,disconnect}.
 */
@RestController
@RequestMapping("/api/sage")
@PreAuthorize("isAuthenticated()")
@ConditionalOnProperty(name = "clenzy.sage.client-id")
public class SageOAuthController {

    private static final Logger log = LoggerFactory.getLogger(SageOAuthController.class);

    private final SageOAuthService oauthService;
    private final TenantContext tenantContext;

    public SageOAuthController(SageOAuthService oauthService, TenantContext tenantContext) {
        this.oauthService = oauthService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/connect")
    public ResponseEntity<Map<String, String>> connect(@AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = getUserId(jwt);

        if (oauthService.isConnected(orgId)) {
            return ResponseEntity.ok(Map.of(
                "status", "already_connected",
                "message", "Organisation deja connectee a Sage"
            ));
        }

        return ResponseEntity.ok(Map.of(
            "authorization_url", oauthService.getAuthorizationUrl(userId, orgId),
            "status", "redirect"
        ));
    }

    @GetMapping("/callback")
    @PreAuthorize("permitAll()")
    public ResponseEntity<String> callback(@RequestParam("code") String code,
                                             @RequestParam("state") String state) {
        Optional<OAuthStateService.StatePayload> payload = oauthService.validateAndConsumeState(state);
        if (payload.isEmpty()) {
            log.warn("Sage OAuth callback — state invalide: {}", state);
            return ResponseEntity.status(302)
                .header("Location", "/settings?tab=integrations&status=error&reason=invalid_state")
                .build();
        }
        try {
            oauthService.exchangeCodeForToken(code, payload.get().userId(), payload.get().orgId());
            // TODO post-MVP : appeler GET /businesses pour stocker la business
            // Sage selectionnee via oauthService.saveBusiness(orgId, id, name).
            return ResponseEntity.status(302)
                .header("Location", "/settings?tab=integrations&status=success")
                .build();
        } catch (Exception e) {
            log.error("Sage OAuth callback — erreur echange code: {}", e.getMessage(), e);
            return ResponseEntity.status(302)
                .header("Location", "/settings?tab=integrations&status=error&reason=token_exchange")
                .build();
        }
    }

    @PostMapping("/disconnect")
    public ResponseEntity<Map<String, String>> disconnect() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        try {
            oauthService.revokeToken(orgId);
            return ResponseEntity.ok(Map.of(
                "status", "disconnected",
                "message", "Deconnexion Sage reussie"
            ));
        } catch (Exception e) {
            log.error("Sage disconnect — erreur: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "error",
                "message", "Erreur lors de la deconnexion: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<SageConnection> connection = oauthService.getConnection(orgId);

        Map<String, Object> result = new HashMap<>();
        if (connection.isPresent() && connection.get().getStatus() == SageConnection.Status.ACTIVE) {
            SageConnection conn = connection.get();
            result.put("connected", true);
            result.put("connectedAt", conn.getConnectedAt());
            result.put("scopes", conn.getScopes());
            result.put("businessId", conn.getBusinessId());
            result.put("businessName", conn.getBusinessName());
            result.put("status", conn.getStatus().name());
        } else {
            result.put("connected", false);
            if (connection.isPresent()) {
                result.put("status", connection.get().getStatus().name());
                result.put("errorMessage", connection.get().getErrorMessage());
            }
        }
        return ResponseEntity.ok(result);
    }

    private Long getUserId(Jwt jwt) {
        Object userIdClaim = jwt.getClaim("userId");
        if (userIdClaim instanceof Number n) return n.longValue();
        String sub = jwt.getSubject();
        return (long) (sub != null ? sub.hashCode() : 0);
    }
}
