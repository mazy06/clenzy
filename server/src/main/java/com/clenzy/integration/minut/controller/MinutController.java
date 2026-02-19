package com.clenzy.integration.minut.controller;

import com.clenzy.dto.noise.MinutConnectionStatusDto;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.service.MinutApiService;
import com.clenzy.integration.minut.service.MinutOAuthService;
import com.clenzy.repository.NoiseDeviceRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Controller OAuth2 et API pour l'integration Minut.
 *
 * Endpoints :
 * - GET  /api/minut/connect     : URL d'autorisation OAuth
 * - GET  /api/minut/callback    : callback OAuth (public)
 * - POST /api/minut/disconnect  : revoquer connexion
 * - GET  /api/minut/status      : statut connexion
 * - GET  /api/minut/devices     : devices Minut disponibles
 * - GET  /api/minut/homes       : homes Minut
 */
@RestController
@RequestMapping("/api/minut")
@Tag(name = "Minut Integration", description = "Gestion de la connexion OAuth et API Minut")
public class MinutController {

    private static final Logger log = LoggerFactory.getLogger(MinutController.class);

    private final MinutOAuthService oAuthService;
    private final MinutApiService apiService;
    private final NoiseDeviceRepository noiseDeviceRepository;

    public MinutController(MinutOAuthService oAuthService,
                           MinutApiService apiService,
                           NoiseDeviceRepository noiseDeviceRepository) {
        this.oAuthService = oAuthService;
        this.apiService = apiService;
        this.noiseDeviceRepository = noiseDeviceRepository;
    }

    // ─── OAuth Flow ──────────────────────────────────────────────

    @GetMapping("/connect")
    @Operation(summary = "Initier la connexion OAuth Minut",
            description = "Retourne l'URL de redirection vers la page d'autorisation Minut")
    public ResponseEntity<Map<String, String>> connect(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        if (oAuthService.isConnected(userId)) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "already_connected");
            response.put("message", "Votre compte Minut est deja connecte");
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
    @Operation(summary = "Callback OAuth Minut",
            description = "Recoit le code d'autorisation et l'echange contre un token")
    public ResponseEntity<Map<String, Object>> callback(
            @RequestParam("code") String code,
            @RequestParam("state") String state) {
        try {
            MinutConnection connection = oAuthService.exchangeCodeForToken(code, state);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "connected");
            response.put("message", "Connexion Minut etablie avec succes");
            response.put("minut_user_id", connection.getMinutUserId());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Erreur callback OAuth Minut: {}", e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Echec de la connexion Minut");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @PostMapping("/disconnect")
    @Operation(summary = "Deconnecter le compte Minut",
            description = "Revoque le token OAuth et supprime la connexion")
    public ResponseEntity<Map<String, String>> disconnect(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        try {
            oAuthService.revokeToken(userId);

            Map<String, String> response = new HashMap<>();
            response.put("status", "disconnected");
            response.put("message", "Compte Minut deconnecte");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Erreur deconnexion Minut: {}", e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Erreur lors de la deconnexion");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @GetMapping("/status")
    @Operation(summary = "Statut de la connexion Minut",
            description = "Retourne le statut actuel de la connexion OAuth et le nombre de capteurs lies")
    public ResponseEntity<MinutConnectionStatusDto> status(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        MinutConnectionStatusDto statusDto = new MinutConnectionStatusDto();

        Optional<MinutConnection> connectionOpt = oAuthService.getConnectionStatus(userId);
        if (connectionOpt.isPresent()) {
            MinutConnection connection = connectionOpt.get();
            statusDto.setConnected(connection.isActive());
            statusDto.setStatus(connection.getStatus().name());
            statusDto.setMinutUserId(connection.getMinutUserId());
            statusDto.setOrganizationId(connection.getOrganizationId());
            statusDto.setConnectedAt(connection.getConnectedAt());
            statusDto.setLastSyncAt(connection.getLastSyncAt());
            statusDto.setErrorMessage(connection.getErrorMessage());

            long deviceCount = noiseDeviceRepository.countByUserId(userId);
            statusDto.setDeviceCount(deviceCount);
        } else {
            statusDto.setConnected(false);
            statusDto.setStatus("NOT_CONNECTED");
            statusDto.setDeviceCount(0);
        }

        return ResponseEntity.ok(statusDto);
    }

    // ─── API Proxy ───────────────────────────────────────────────

    @GetMapping("/devices/{deviceId}")
    @Operation(summary = "Details d'un device Minut")
    public ResponseEntity<?> getDevice(@AuthenticationPrincipal Jwt jwt,
                                       @PathVariable String deviceId) {
        String userId = jwt.getSubject();

        try {
            Map<String, Object> device = apiService.getDevice(userId, deviceId);
            return ResponseEntity.ok(device);
        } catch (Exception e) {
            log.error("Erreur recuperation device Minut {}: {}", deviceId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors de la recuperation du device Minut"
            ));
        }
    }

    @GetMapping("/homes/{homeId}")
    @Operation(summary = "Details d'un home Minut")
    public ResponseEntity<?> getHome(@AuthenticationPrincipal Jwt jwt,
                                     @PathVariable String homeId) {
        String userId = jwt.getSubject();

        try {
            Map<String, Object> home = apiService.getHome(userId, homeId);
            return ResponseEntity.ok(home);
        } catch (Exception e) {
            log.error("Erreur recuperation home Minut {}: {}", homeId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors de la recuperation du home Minut"
            ));
        }
    }

    @GetMapping("/homes/{homeId}/events")
    @Operation(summary = "Evenements d'un home Minut")
    public ResponseEntity<?> getHomeEvents(@AuthenticationPrincipal Jwt jwt,
                                            @PathVariable String homeId,
                                            @RequestParam(required = false) String startAt,
                                            @RequestParam(required = false) String endAt,
                                            @RequestParam(required = false) String eventTypes) {
        String userId = jwt.getSubject();

        try {
            Map<String, Object> events = apiService.getHomeEvents(userId, homeId, startAt, endAt, eventTypes);
            return ResponseEntity.ok(events);
        } catch (Exception e) {
            log.error("Erreur recuperation evenements home Minut {}: {}", homeId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors de la recuperation des evenements"
            ));
        }
    }

    @GetMapping("/homes/{homeId}/disturbance")
    @Operation(summary = "Configuration monitoring bruit d'un home Minut")
    public ResponseEntity<?> getDisturbanceConfig(@AuthenticationPrincipal Jwt jwt,
                                                   @PathVariable String homeId) {
        String userId = jwt.getSubject();

        try {
            Map<String, Object> config = apiService.getDisturbanceConfig(userId, homeId);
            return ResponseEntity.ok(config);
        } catch (Exception e) {
            log.error("Erreur recuperation config disturbance home {}: {}", homeId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors de la recuperation de la configuration"
            ));
        }
    }

    @PutMapping("/homes/{homeId}/disturbance")
    @Operation(summary = "Mettre a jour la config monitoring bruit d'un home Minut")
    public ResponseEntity<?> updateDisturbanceConfig(@AuthenticationPrincipal Jwt jwt,
                                                      @PathVariable String homeId,
                                                      @RequestBody Map<String, Object> config) {
        String userId = jwt.getSubject();

        try {
            Map<String, Object> result = apiService.updateDisturbanceConfig(userId, homeId, config);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Erreur mise a jour config disturbance home {}: {}", homeId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors de la mise a jour de la configuration"
            ));
        }
    }
}
