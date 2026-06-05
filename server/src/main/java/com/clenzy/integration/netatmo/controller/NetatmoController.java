package com.clenzy.integration.netatmo.controller;

import com.clenzy.dto.netatmo.NetatmoConfigStatusDto;
import com.clenzy.dto.netatmo.NetatmoConnectionStatusDto;
import com.clenzy.dto.netatmo.NetatmoModuleDto;
import com.clenzy.dto.netatmo.UpdateNetatmoConfigDto;
import com.clenzy.integration.netatmo.model.NetatmoConnection;
import com.clenzy.integration.netatmo.service.NetatmoApiService;
import com.clenzy.integration.netatmo.service.NetatmoOAuthService;
import com.clenzy.integration.netatmo.service.NetatmoPlatformConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
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
    private final NetatmoApiService apiService;

    public NetatmoController(NetatmoOAuthService oAuthService,
                             NetatmoPlatformConfigService configService,
                             NetatmoApiService apiService) {
        this.oAuthService = oAuthService;
        this.configService = configService;
        this.apiService = apiService;
    }

    // ─── Découverte d'appareils (pour le wizard d'ajout) ───

    @GetMapping("/devices")
    @Operation(summary = "Liste les modules Netatmo découverts (station météo) pour l'ajout d'un capteur")
    public ResponseEntity<?> listDevices(@AuthenticationPrincipal Jwt jwt) {
        try {
            List<NetatmoModuleDto> modules = apiService.listWeatherModules(jwt.getSubject());
            return ResponseEntity.ok(modules);
        } catch (Exception e) {
            log.error("Erreur liste devices Netatmo: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error", "message", "Compte Netatmo non relié ou indisponible"));
        }
    }

    @GetMapping("/thermostats")
    @Operation(summary = "Liste les thermostats / vannes Netatmo découverts (pour l'ajout d'un thermostat)")
    public ResponseEntity<?> listThermostats(@AuthenticationPrincipal Jwt jwt) {
        try {
            List<NetatmoModuleDto> thermostats = apiService.listThermostats(jwt.getSubject());
            return ResponseEntity.ok(thermostats);
        } catch (Exception e) {
            log.error("Erreur liste thermostats Netatmo: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error", "message", "Compte Netatmo non relié ou indisponible"));
        }
    }

    @GetMapping("/security")
    @Operation(summary = "Liste les modules sécurité Netatmo (détecteur fumée, door tags) découverts")
    public ResponseEntity<?> listSecurity(@AuthenticationPrincipal Jwt jwt) {
        try {
            List<NetatmoModuleDto> modules = apiService.listSecurityModules(jwt.getSubject());
            return ResponseEntity.ok(modules);
        } catch (Exception e) {
            log.error("Erreur liste sécurité Netatmo: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error", "message", "Compte Netatmo non relié ou indisponible"));
        }
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

    // Connexion d'un compte = par utilisateur (modèle Netatmo par-hôte) → accessible à
    // tout utilisateur authentifié (chaque hôte connecte SON compte depuis le hub).
    // La config de l'app (client_id/secret, /config) reste réservée aux SUPER_ADMIN/MANAGER.
    @GetMapping("/connect")
    @Operation(summary = "Initier la connexion OAuth Netatmo (compte de l'utilisateur courant)")
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

    /**
     * Callback OAuth Netatmo. PUBLIC : appele par une redirection navigateur depuis Netatmo
     * (pas de JWT/session) → {@code permitAll()} pour ne pas etre bloque par la method-security
     * de classe. L'org est resolue via le state Redis (stocke au /connect authentifie), pas le
     * TenantContext. Redirige vers les Reglages (UX) plutot que de renvoyer du JSON brut.
     */
    @GetMapping("/callback")
    @Operation(summary = "Callback OAuth Netatmo")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Void> callback(
            @RequestParam("code") String code,
            @RequestParam("state") String state) {
        String target;
        try {
            NetatmoOAuthService.OAuthState st = oAuthService.consumeState(state);
            oAuthService.exchangeCodeForToken(code, st.userId(), st.organizationId());
            target = "/properties?tab=connected-objects&netatmo=connected";
        } catch (Exception e) {
            log.error("Erreur callback OAuth Netatmo: {}", e.getMessage());
            target = "/properties?tab=connected-objects&netatmo=error";
        }
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(target)).build();
    }

    @PostMapping("/disconnect")
    @Operation(summary = "Deconnecter le compte Netatmo de l'utilisateur courant")
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
