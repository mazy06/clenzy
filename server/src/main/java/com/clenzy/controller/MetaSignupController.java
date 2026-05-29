package com.clenzy.controller;

import com.clenzy.service.messaging.whatsapp.MetaSignupService;
import com.clenzy.service.messaging.whatsapp.MetaSignupService.MetaSignupException;
import com.clenzy.service.messaging.whatsapp.MetaSignupService.SignupResult;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Endpoints pour le flow Meta Embedded Signup (cf. docs/meta-app-review/embedded-signup-flow.md).
 *
 * <ul>
 *   <li>{@code GET  /api/whatsapp/meta/app-config} : config publique pour init SDK FB (frontend)</li>
 *   <li>{@code POST /api/whatsapp/meta/oauth-callback} : code OAuth -> provisionning whatsapp_configs</li>
 * </ul>
 *
 * <h3>Securite</h3>
 * Tous les endpoints exigent {@code isAuthenticated()}. Le scope tenant
 * (organizationId) est resolu via {@link TenantContext}, pas de cross-tenant.
 *
 * <h3>Erreurs</h3>
 * - {@link MetaSignupException} (Meta API down, code expire, WABA introuvable) -> 503 + message clair
 * - Autres erreurs -> 500 par GlobalExceptionHandler
 */
@RestController
@RequestMapping("/api/whatsapp/meta")
@PreAuthorize("isAuthenticated()")
public class MetaSignupController {

    private static final Logger log = LoggerFactory.getLogger(MetaSignupController.class);

    private final MetaSignupService metaSignupService;
    private final TenantContext tenantContext;

    public MetaSignupController(MetaSignupService metaSignupService, TenantContext tenantContext) {
        this.metaSignupService = metaSignupService;
        this.tenantContext = tenantContext;
    }

    /**
     * Retourne la config publique necessaire au SDK FB JS cote frontend
     * (appId + configId + version Graph API). Ne fuite JAMAIS l'app-secret.
     */
    @GetMapping("/app-config")
    public ResponseEntity<Map<String, Object>> getAppConfig() {
        try {
            return ResponseEntity.ok(metaSignupService.getPublicAppConfig());
        } catch (MetaSignupException e) {
            // 503 explicite : pas configurable cote frontend, c'est un manque cote serveur
            log.warn("App config Meta indisponible: {}", e.getMessage());
            return ResponseEntity.status(503).body(Map.of(
                "error", "Meta Embedded Signup non disponible",
                "details", e.getMessage(),
                "fallback", "Utiliser la configuration manuelle (apiToken/phoneNumberId/businessAccountId)"));
        }
    }

    /**
     * Recoit le code OAuth court-vie du popup Meta cote frontend, fait l'echange
     * complet (token + WABA + phone number), et provisionne whatsapp_configs.
     *
     * <p>Body de la requete : {@code { "code": "AQB...xxxxx" }}</p>
     *
     * <p>Body de la reponse (success) :
     * {@code { "success": true, "phoneNumber": "+33...", "wabaId": "...", "phoneNumberId": "...", "configId": 42 } }
     * </p>
     *
     * <p>Body de la reponse (echec) : HTTP 503 avec
     * {@code { "error": "...", "details": "..." } }</p>
     */
    @PostMapping("/oauth-callback")
    public ResponseEntity<?> oauthCallback(@RequestBody Map<String, String> body) {
        String code = body == null ? null : body.get("code");
        Long orgId = tenantContext.getRequiredOrganizationId();

        try {
            SignupResult result = metaSignupService.completeSignup(code, orgId);
            return ResponseEntity.ok(result);
        } catch (MetaSignupException e) {
            log.warn("Meta Embedded Signup echoue pour org {}: {}", orgId, e.getMessage());
            return ResponseEntity.status(503).body(Map.of(
                "success", false,
                "error", e.getMessage(),
                "fallback", "Reessayer ou utiliser la configuration manuelle"));
        }
    }
}
