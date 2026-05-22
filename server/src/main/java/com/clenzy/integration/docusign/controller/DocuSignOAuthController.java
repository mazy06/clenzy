package com.clenzy.integration.docusign.controller;

import com.clenzy.integration.docusign.model.DocuSignConnection;
import com.clenzy.integration.docusign.service.DocuSignOAuthService;
import com.clenzy.integration.oauth.OAuthStateService;
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
 * Controller OAuth2 DocuSign — meme contrat REST que {@code PennylaneOAuthController}.
 * Endpoints :
 * <ul>
 *   <li>{@code GET /api/docusign/connect}    — initie le flow OAuth</li>
 *   <li>{@code GET /api/docusign/callback}   — callback PUBLIC (pas de JWT)</li>
 *   <li>{@code POST /api/docusign/disconnect}— revoque la connexion</li>
 *   <li>{@code GET /api/docusign/status}     — statut de la connexion</li>
 * </ul>
 *
 * <p>Active uniquement si {@code clenzy.docusign.client-id} est defini.</p>
 */
@RestController
@RequestMapping("/api/docusign")
@PreAuthorize("isAuthenticated()")
@ConditionalOnProperty(name = "clenzy.docusign.client-id")
public class DocuSignOAuthController {

    private static final Logger log = LoggerFactory.getLogger(DocuSignOAuthController.class);

    private final DocuSignOAuthService oauthService;
    private final TenantContext tenantContext;

    public DocuSignOAuthController(DocuSignOAuthService oauthService,
                                     TenantContext tenantContext) {
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
                "message", "Organisation deja connectee a DocuSign"
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
            log.warn("DocuSign OAuth callback — state invalide: {}", state);
            return ResponseEntity.status(302)
                .header("Location", "/settings?tab=integrations&status=error&reason=invalid_state")
                .build();
        }

        try {
            oauthService.exchangeCodeForToken(code, payload.get().userId(), payload.get().orgId());
            return ResponseEntity.status(302)
                .header("Location", "/settings?tab=integrations&status=success")
                .build();
        } catch (Exception e) {
            log.error("DocuSign OAuth callback — erreur echange code: {}", e.getMessage(), e);
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
                "message", "Deconnexion DocuSign reussie"
            ));
        } catch (Exception e) {
            log.error("DocuSign disconnect — erreur: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "error",
                "message", "Erreur lors de la deconnexion: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<DocuSignConnection> connection = oauthService.getConnection(orgId);

        Map<String, Object> result = new HashMap<>();
        if (connection.isPresent() && connection.get().getStatus() == DocuSignConnection.Status.ACTIVE) {
            DocuSignConnection conn = connection.get();
            result.put("connected", true);
            result.put("connectedAt", conn.getConnectedAt());
            result.put("scopes", conn.getScopes());
            result.put("accountId", conn.getAccountId());
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
        if (userIdClaim instanceof Number n) {
            return n.longValue();
        }
        String sub = jwt.getSubject();
        return (long) (sub != null ? sub.hashCode() : 0);
    }
}
