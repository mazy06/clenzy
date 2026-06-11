package com.clenzy.integration.tuya.controller;

import com.clenzy.dto.noise.TuyaConnectionStatusDto;
import com.clenzy.integration.tuya.config.TuyaConfig;
import com.clenzy.integration.tuya.dto.TuyaAppAccountDto;
import com.clenzy.integration.tuya.dto.TuyaAppSdkCredentialsDto;
import com.clenzy.integration.tuya.dto.TuyaConfigStatusDto;
import com.clenzy.integration.tuya.dto.UpdateTuyaConfigDto;
import com.clenzy.integration.tuya.model.TuyaAppAccount;
import com.clenzy.integration.tuya.model.TuyaConnection;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.integration.tuya.service.TuyaAppAccountService;
import com.clenzy.integration.tuya.service.TuyaDeviceQueryService;
import com.clenzy.integration.tuya.service.TuyaPlatformConfigService;
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
 * Controller pour l'integration Tuya Cloud.
 *
 * Endpoints :
 * - POST /api/tuya/connect         : configurer connexion
 * - POST /api/tuya/disconnect      : revoquer connexion
 * - GET  /api/tuya/status          : statut connexion
 * - GET  /api/tuya/devices/{id}    : infos device
 * - GET  /api/tuya/devices/{id}/status : data points actuels
 */
@RestController
@RequestMapping("/api/tuya")
@Tag(name = "Tuya Integration", description = "Gestion de la connexion et API Tuya Cloud")
@PreAuthorize("isAuthenticated()")
public class TuyaController {

    private static final Logger log = LoggerFactory.getLogger(TuyaController.class);

    private final TuyaApiService apiService;
    private final TuyaDeviceQueryService deviceQueryService;
    private final TuyaConfig tuyaConfig;
    private final TuyaPlatformConfigService platformConfigService;
    private final TuyaAppAccountService appAccountService;

    public TuyaController(TuyaApiService apiService,
                          TuyaDeviceQueryService deviceQueryService,
                          TuyaConfig tuyaConfig,
                          TuyaPlatformConfigService platformConfigService,
                          TuyaAppAccountService appAccountService) {
        this.apiService = apiService;
        this.deviceQueryService = deviceQueryService;
        this.tuyaConfig = tuyaConfig;
        this.platformConfigService = platformConfigService;
        this.appAccountService = appAccountService;
    }

    // ─── Configuration du projet Tuya (credentials plateforme, editables depuis l'UI) ───

    @GetMapping("/config")
    @Operation(summary = "Statut de configuration du projet Tuya",
            description = "Indique si les credentials du projet Tuya sont enregistres (le secret n'est jamais renvoye)")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<TuyaConfigStatusDto> getConfig() {
        return ResponseEntity.ok(new TuyaConfigStatusDto(
                tuyaConfig.isConfigured(),
                tuyaConfig.getAccessId(),
                tuyaConfig.getApiBaseUrl(),
                tuyaConfig.getRegion(),
                tuyaConfig.getAppSchema(),
                tuyaConfig.getAppKey(),
                tuyaConfig.getAndroidAppKey()));
    }

    @PutMapping("/config")
    @Operation(summary = "Enregistre les credentials du projet Tuya",
            description = "Stocke l'access_id et l'access_secret (chiffre) en base. Secret optionnel : vide = inchange")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<?> updateConfig(@AuthenticationPrincipal Jwt jwt,
                                          @RequestBody UpdateTuyaConfigDto body) {
        if (body == null || body.accessId() == null || body.accessId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "invalid_request",
                    "message", "L'Access ID est obligatoire"));
        }
        platformConfigService.save(body, jwt.getSubject());
        log.info("Config projet Tuya mise a jour par {}", jwt.getSubject());
        return ResponseEntity.ok(new TuyaConfigStatusDto(
                tuyaConfig.isConfigured(),
                tuyaConfig.getAccessId(),
                tuyaConfig.getApiBaseUrl(),
                tuyaConfig.getRegion(),
                tuyaConfig.getAppSchema(),
                tuyaConfig.getAppKey(),
                tuyaConfig.getAndroidAppKey()));
    }

    // ─── Compte app Tuya de l'hote (modele C) ────────────────────

    @PostMapping("/app-account")
    @Operation(summary = "Provisionne / retourne le compte app Tuya de l'hote",
            description = "Cree (si besoin) un compte app Tuya sous le schema du projet et retourne ses "
                    + "identifiants pour la connexion SDK mobile avant l'appairage (modele C)")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> appAccount(@AuthenticationPrincipal Jwt jwt) {
        try {
            TuyaAppAccount acc = appAccountService.getOrCreate(jwt.getSubject());
            return ResponseEntity.ok(new TuyaAppAccountDto(
                    acc.getTuyaUid(),
                    acc.getTuyaUsername(),
                    appAccountService.decryptSecret(acc),
                    acc.getCountryCode(),
                    tuyaConfig.getAppSchema()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "configuration_missing", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Erreur provisioning compte app Tuya pour {}: {}", jwt.getSubject(), e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "provisioning_failed",
                    "message", "Echec du provisioning du compte app Tuya"));
        }
    }

    @GetMapping("/app-sdk-credentials")
    @Operation(summary = "Credentials App SDK Tuya pour l'init du SDK natif mobile",
            description = "Retourne l'AppKey + AppSecret de l'App SDK pour la plateforme demandee (ios|android). "
                    + "Le SDK Tuya exige ces valeurs cote client (deja embarquees dans tout build) : exposition "
                    + "deliberee a l'app authentifiee, mais configurable en base.")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> appSdkCredentials(@RequestParam(defaultValue = "android") String platform) {
        boolean ios = "ios".equalsIgnoreCase(platform);
        String appKey = ios ? tuyaConfig.getAppKey() : tuyaConfig.getAndroidAppKey();
        String appSecret = ios ? tuyaConfig.getAppSecret() : tuyaConfig.getAndroidAppSecret();
        if (appKey == null || appKey.isBlank() || appSecret == null || appSecret.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "configuration_missing",
                    "message", "App SDK non configure pour la plateforme " + (ios ? "ios" : "android")));
        }
        return ResponseEntity.ok(new TuyaAppSdkCredentialsDto(ios ? "ios" : "android", appKey, appSecret));
    }

    // ─── Connection Management ───────────────────────────────────

    @PostMapping("/connect")
    @Operation(summary = "Configurer la connexion Tuya",
            description = "Teste la connexion avec les credentials du projet et enregistre le token")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<Map<String, Object>> connect(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        try {
            TuyaConnection connection = apiService.createConnection(userId);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "connected");
            response.put("message", "Connexion Tuya etablie avec succes");
            response.put("tuya_uid", connection.getTuyaUid());

            return ResponseEntity.ok(response);

        } catch (IllegalStateException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "configuration_missing");
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);

        } catch (Exception e) {
            log.error("Erreur connexion Tuya pour user {}: {}", userId, e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Echec de la connexion Tuya");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @PostMapping("/disconnect")
    @Operation(summary = "Deconnecter le compte Tuya",
            description = "Revoque la connexion Tuya")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<Map<String, String>> disconnect(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        try {
            apiService.disconnect(userId);

            Map<String, String> response = new HashMap<>();
            response.put("status", "disconnected");
            response.put("message", "Compte Tuya deconnecte");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Erreur deconnexion Tuya: {}", e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "Erreur lors de la deconnexion");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @GetMapping("/status")
    @Operation(summary = "Statut de la connexion Tuya",
            description = "Retourne le statut actuel de la connexion Tuya")
    public ResponseEntity<TuyaConnectionStatusDto> status(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        TuyaConnectionStatusDto statusDto = new TuyaConnectionStatusDto();

        Optional<TuyaConnection> connectionOpt = apiService.getConnectionStatus(userId);
        if (connectionOpt.isPresent()) {
            TuyaConnection connection = connectionOpt.get();
            statusDto.setConnected(connection.isActive());
            statusDto.setStatus(connection.getStatus().name());
            statusDto.setTuyaUid(connection.getTuyaUid());
            statusDto.setConnectedAt(connection.getConnectedAt());
            statusDto.setLastSyncAt(connection.getLastSyncAt());
            statusDto.setErrorMessage(connection.getErrorMessage());

            long deviceCount = deviceQueryService.countDevicesForUser(userId);
            statusDto.setDeviceCount(deviceCount);
        } else {
            statusDto.setConnected(false);
            statusDto.setStatus("NOT_CONNECTED");
            statusDto.setDeviceCount(0);
        }

        return ResponseEntity.ok(statusDto);
    }

    // ─── Device API Proxy ────────────────────────────────────────

    @GetMapping("/devices")
    @Operation(summary = "Decouverte : liste les devices du compte Tuya de l'organisation")
    public ResponseEntity<?> listDevices() {
        try {
            return ResponseEntity.ok(apiService.listOrgDevices());
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @GetMapping("/devices/{deviceId}")
    @Operation(summary = "Infos d'un device Tuya")
    public ResponseEntity<?> getDeviceInfo(@AuthenticationPrincipal Jwt jwt,
                                            @PathVariable String deviceId) {
        String userId = jwt.getSubject();
        try {
            // Ownership: verifier que le device appartient a l'utilisateur
            if (!deviceQueryService.userOwnsDevice(userId, deviceId)) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "access_denied",
                        "message", "Vous n'avez pas acces a ce device"
                ));
            }
            Map<String, Object> device = apiService.getDeviceInfo(deviceId);
            return ResponseEntity.ok(device);
        } catch (Exception e) {
            log.error("Erreur recuperation device Tuya {}: {}", deviceId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors de la recuperation du device Tuya"
            ));
        }
    }

    @GetMapping("/devices/{deviceId}/status")
    @Operation(summary = "Data points actuels d'un device Tuya",
            description = "Retourne les data points actuels (dont DP12 noise_value)")
    public ResponseEntity<?> getDeviceStatus(@AuthenticationPrincipal Jwt jwt,
                                              @PathVariable String deviceId) {
        String userId = jwt.getSubject();
        try {
            // Ownership: verifier que le device appartient a l'utilisateur
            if (!deviceQueryService.userOwnsDevice(userId, deviceId)) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "access_denied",
                        "message", "Vous n'avez pas acces a ce device"
                ));
            }
            Map<String, Object> status = apiService.getDeviceStatus(deviceId);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            log.error("Erreur recuperation status device Tuya {}: {}", deviceId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors de la recuperation du status device Tuya"
            ));
        }
    }

    @GetMapping("/devices/{deviceId}/logs")
    @Operation(summary = "Historique data points d'un device Tuya")
    public ResponseEntity<?> getDeviceLogs(@AuthenticationPrincipal Jwt jwt,
                                            @PathVariable String deviceId,
                                            @RequestParam long startTime,
                                            @RequestParam long endTime) {
        String userId = jwt.getSubject();
        try {
            // Ownership: verifier que le device appartient a l'utilisateur
            if (!deviceQueryService.userOwnsDevice(userId, deviceId)) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "access_denied",
                        "message", "Vous n'avez pas acces a ce device"
                ));
            }
            Map<String, Object> logs = apiService.getDeviceLogs(deviceId, startTime, endTime);
            return ResponseEntity.ok(logs);
        } catch (Exception e) {
            log.error("Erreur recuperation logs device Tuya {}: {}", deviceId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors de la recuperation des logs device Tuya"
            ));
        }
    }
}
