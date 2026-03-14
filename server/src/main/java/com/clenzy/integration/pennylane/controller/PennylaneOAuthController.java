package com.clenzy.integration.pennylane.controller;

import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.integration.pennylane.service.PennylaneOAuthService;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Controller OAuth2 pour la connexion Pennylane.
 * Suit le pattern AirbnbOAuthController.
 */
@RestController
@RequestMapping("/api/pennylane")
@PreAuthorize("isAuthenticated()")
@ConditionalOnProperty(name = "clenzy.pennylane.client-id")
public class PennylaneOAuthController {

    private static final Logger log = LoggerFactory.getLogger(PennylaneOAuthController.class);

    private final PennylaneOAuthService oauthService;
    private final TenantContext tenantContext;

    public PennylaneOAuthController(PennylaneOAuthService oauthService,
                                     TenantContext tenantContext) {
        this.oauthService = oauthService;
        this.tenantContext = tenantContext;
    }

    /**
     * Initie la connexion OAuth2 Pennylane.
     * Retourne l'URL d'autorisation vers laquelle rediriger l'utilisateur.
     */
    @GetMapping("/connect")
    public ResponseEntity<Map<String, String>> connect(@AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = getUserId(jwt);

        if (oauthService.isConnected(orgId)) {
            return ResponseEntity.ok(Map.of(
                "status", "already_connected",
                "message", "Organisation deja connectee a Pennylane"
            ));
        }

        String authUrl = oauthService.getAuthorizationUrl(userId, orgId);

        return ResponseEntity.ok(Map.of(
            "authorization_url", authUrl,
            "status", "redirect"
        ));
    }

    /**
     * Callback OAuth2 Pennylane. Endpoint PUBLIC (pas de JWT requis).
     * Appele par Pennylane apres autorisation de l'utilisateur.
     */
    @GetMapping("/callback")
    public ResponseEntity<String> callback(
            @RequestParam("code") String code,
            @RequestParam("state") String state) {

        Optional<Map<String, Long>> stateData = oauthService.validateAndConsumeState(state);

        if (stateData.isEmpty()) {
            log.warn("Pennylane OAuth callback — state invalide: {}", state);
            return ResponseEntity.status(302)
                .header("Location", "/settings?tab=integrations&status=error&reason=invalid_state")
                .build();
        }

        Long userId = stateData.get().get("userId");
        Long orgId = stateData.get().get("orgId");

        try {
            oauthService.exchangeCodeForToken(code, userId, orgId);

            return ResponseEntity.status(302)
                .header("Location", "/settings?tab=integrations&status=success")
                .build();
        } catch (Exception e) {
            log.error("Pennylane OAuth callback — erreur echange code: {}", e.getMessage(), e);
            return ResponseEntity.status(302)
                .header("Location", "/settings?tab=integrations&status=error&reason=token_exchange")
                .build();
        }
    }

    /**
     * Deconnecte l'organisation de Pennylane.
     */
    @PostMapping("/disconnect")
    public ResponseEntity<Map<String, String>> disconnect() {
        Long orgId = tenantContext.getRequiredOrganizationId();

        try {
            oauthService.revokeToken(orgId);
            return ResponseEntity.ok(Map.of(
                "status", "disconnected",
                "message", "Deconnexion Pennylane reussie"
            ));
        } catch (Exception e) {
            log.error("Pennylane disconnect — erreur: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "error",
                "message", "Erreur lors de la deconnexion: " + e.getMessage()
            ));
        }
    }

    /**
     * Retourne le statut de connexion Pennylane pour l'organisation.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Optional<PennylaneConnection> connection = oauthService.getConnection(orgId);

        Map<String, Object> result = new HashMap<>();

        if (connection.isPresent() && connection.get().isActive()) {
            PennylaneConnection conn = connection.get();
            result.put("connected", true);
            result.put("connectedAt", conn.getConnectedAt());
            result.put("lastSyncAt", conn.getLastSyncAt());
            result.put("scopes", conn.getScopes());
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

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Long getUserId(Jwt jwt) {
        String sub = jwt.getSubject();
        // Le subject Keycloak est un UUID, on utilise le claim "userId" s'il existe
        Object userIdClaim = jwt.getClaim("userId");
        if (userIdClaim instanceof Number) {
            return ((Number) userIdClaim).longValue();
        }
        // Fallback : le subject lui-meme n'est pas un Long, on utilise le hash
        return (long) sub.hashCode();
    }
}
