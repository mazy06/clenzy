package com.clenzy.integration.netatmo.controller;

import com.clenzy.dto.netatmo.NetatmoConfigStatusDto;
import com.clenzy.dto.netatmo.NetatmoConnectionStatusDto;
import com.clenzy.dto.netatmo.UpdateNetatmoConfigDto;
import com.clenzy.integration.netatmo.model.NetatmoConnection;
import com.clenzy.integration.netatmo.service.NetatmoOAuthService;
import com.clenzy.integration.netatmo.service.NetatmoPlatformConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
 * Controller OAuth2 pour l'integration Netatmo. Calque sur MinutController.
 *
 * - GET  /api/netatmo/connect    : URL d'autorisation OAuth (SUPER_ADMIN/SUPER_MANAGER)
 * - GET  /api/netatmo/callback   : callback OAuth (public — cf. SecurityConfigProd)
 * - POST /api/netatmo/disconnect : revoquer la connexion
 * - GET  /api/netatmo/status     : statut de la connexion
 */
@RestController
@RequestMapping("/api/netatmo")
@Tag(name = "Netatmo Integration", description = "Connexion OAuth et API Netatmo")
@PreAuthorize("isAuthenticated()")
public class NetatmoController {

    private static final Logger log = LoggerFactory.getLogger(NetatmoController.class);

    private final NetatmoOAuthService oAuthService;
    private final NetatmoPlatformConfigService configService;

    public NetatmoController(NetatmoOAuthService oAuthService,
                             NetatmoPlatformConfigService configService) {
        this.oAuthService = oAuthService;
        this.configService = configService;
    }

    // ─── Configuration de l'app Netatmo (credentials plateforme, editables depuis l'UI) ───

    @GetMapping("/config")
    @Operation(summary = "Statut de configuration de l'app Netatmo")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<NetatmoConfigStatusDto> getConfig() {
        return ResponseEntity.ok(new NetatmoConfigStatusDto(
                configService.isConfigured(), configService.getClientId(), configService.getRedirectUri()));
    }

    @PutMapping("/config")
    @Operation(summary = "Enregistrer les credentials de l'app Netatmo (secret chiffre en base)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<NetatmoConfigStatusDto> updateConfig(@AuthenticationPrincipal Jwt jwt,
                                                               @RequestBody UpdateNetatmoConfigDto dto) {
        configService.save(dto, jwt.getSubject());
        return ResponseEntity.ok(new NetatmoConfigStatusDto(
                configService.isConfigured(), configService.getClientId(), configService.getRedirectUri()));
    }

    @GetMapping("/connect")
    @Operation(summary = "Initier la connexion OAuth Netatmo")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<Map<String, String>> connect(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        if (oAuthService.isConnected(userId)) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "already_connected");
            response.put("message", "Votre compte Netatmo est deja connecte");
            return ResponseEntity.ok(response);
        }

        try {
            String authUrl = oAuthService.getAuthorizationUrl(userId);
            Map<String, String> response = new HashMap<>();
            response.put("authorization_url", authUrl);
            response.put("status", "redirect");
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "configuration_missing");
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/callback")
    @Operation(summary = "Callback OAuth Netatmo")
    public ResponseEntity<Map<String, Object>> callback(
            @RequestParam("code") String code,
            @RequestParam("state") String state) {
        try {
            String userId = oAuthService.validateAndConsumeState(state);
            oAuthService.exchangeCodeForToken(code, userId);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "connected");
            response.put("message", "Connexion Netatmo etablie avec succes");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Erreur callback OAuth Netatmo: {}", e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Echec de la connexion Netatmo");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @PostMapping("/disconnect")
    @Operation(summary = "Deconnecter le compte Netatmo")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<Map<String, String>> disconnect(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        try {
            oAuthService.revokeToken(userId);
            Map<String, String> response = new HashMap<>();
            response.put("status", "disconnected");
            response.put("message", "Compte Netatmo deconnecte");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Erreur deconnexion Netatmo: {}", e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Erreur lors de la deconnexion");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @GetMapping("/status")
    @Operation(summary = "Statut de la connexion Netatmo")
    public ResponseEntity<NetatmoConnectionStatusDto> status(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        NetatmoConnectionStatusDto statusDto = new NetatmoConnectionStatusDto();
        Optional<NetatmoConnection> connectionOpt = oAuthService.getConnectionStatus(userId);
        if (connectionOpt.isPresent()) {
            NetatmoConnection connection = connectionOpt.get();
            statusDto.setConnected(connection.isActive());
            statusDto.setStatus(connection.getStatus().name());
            statusDto.setConnectedAt(connection.getConnectedAt());
            statusDto.setLastSyncAt(connection.getLastSyncAt());
            statusDto.setErrorMessage(connection.getErrorMessage());
            statusDto.setDeviceCount(0); // P1+ : nombre de devices Netatmo synchronises
        } else {
            statusDto.setConnected(false);
            statusDto.setStatus("NOT_CONNECTED");
            statusDto.setDeviceCount(0);
        }
        return ResponseEntity.ok(statusDto);
    }
}
