package com.clenzy.integration.odoo.controller;

import com.clenzy.integration.odoo.dto.OdooConnectionRequest;
import com.clenzy.integration.odoo.dto.OdooStatusDto;
import com.clenzy.integration.odoo.model.OdooConnection;
import com.clenzy.integration.odoo.service.OdooService;
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
 * Controller pour la gestion de la connexion API Odoo d'une organisation.
 *
 * Endpoints :
 *   - POST   /api/odoo/connect     → valide credentials, sauvegarde + chiffre apiKey
 *   - GET    /api/odoo/status      → etat connexion courante
 *   - POST   /api/odoo/disconnect  → supprime la connexion
 *
 * Securite :
 *   - @PreAuthorize("isAuthenticated()") au minimum
 *   - On valide l'orgId via TenantContext (request-scoped)
 *   - L'apiKey n'est JAMAIS retournee dans une reponse
 *
 * Multi-tenant : une seule connexion Odoo par organisation. Si l'org en a deja
 * une, /connect ecrase l'ancienne (apres test de la nouvelle).
 */
@RestController
@RequestMapping("/api/odoo")
@PreAuthorize("isAuthenticated()")
public class OdooConnectionController {

    private static final Logger log = LoggerFactory.getLogger(OdooConnectionController.class);

    private final OdooService odooService;
    private final TenantContext tenantContext;

    public OdooConnectionController(OdooService odooService, TenantContext tenantContext) {
        this.odooService = odooService;
        this.tenantContext = tenantContext;
    }

    /**
     * Teste les credentials puis sauvegarde si OK.
     * Retourne 200 + status si succes, 400 + message si echec de connexion.
     */
    @PostMapping("/connect")
    public ResponseEntity<?> connect(@Valid @RequestBody OdooConnectionRequest request,
                                       @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = getUserId(jwt);

        log.info("Odoo /connect : org={} server={}", orgId, request.serverUrl());

        // 1. Tester la connexion AVANT de sauvegarder
        boolean ok = odooService.testConnection(
                request.serverUrl(),
                request.databaseName(),
                request.userLogin(),
                request.apiKey()
        );

        if (!ok) {
            log.warn("Odoo /connect : test failed for org={} server={}", orgId, request.serverUrl());
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "connection_failed",
                    "message", "Impossible de se connecter a Odoo avec ces identifiants. "
                            + "Verifiez l'URL, le nom de base, le login et l'API key."
            ));
        }

        // 2. Sauvegarder (chiffrement apiKey via OdooApiKeyEncryptionService)
        OdooConnection conn = odooService.saveConnection(
                orgId, userId,
                request.serverUrl(),
                request.databaseName(),
                request.userLogin(),
                request.apiKey()
        );

        return ResponseEntity.ok(OdooStatusDto.fromEntity(conn));
    }

    @GetMapping("/status")
    public ResponseEntity<OdooStatusDto> status() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<OdooConnection> conn = odooService.getConnection(orgId);
        return ResponseEntity.ok(conn.map(OdooStatusDto::fromEntity)
                .orElseGet(OdooStatusDto::notConnected));
    }

    @PostMapping("/disconnect")
    public ResponseEntity<?> disconnect() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        boolean deleted = odooService.disconnect(orgId);
        Map<String, Object> body = new HashMap<>();
        body.put("disconnected", deleted);
        if (!deleted) {
            body.put("message", "Aucune connexion Odoo a deconnecter.");
        }
        return ResponseEntity.ok(body);
    }

    // ---- Helpers ----

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
