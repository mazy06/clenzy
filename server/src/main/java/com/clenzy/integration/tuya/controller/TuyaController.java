package com.clenzy.integration.tuya.controller;

import com.clenzy.dto.noise.TuyaConnectionStatusDto;
import com.clenzy.integration.tuya.model.TuyaConnection;
import com.clenzy.integration.tuya.service.TuyaApiService;
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
public class TuyaController {

    private static final Logger log = LoggerFactory.getLogger(TuyaController.class);

    private final TuyaApiService apiService;
    private final NoiseDeviceRepository noiseDeviceRepository;

    public TuyaController(TuyaApiService apiService,
                          NoiseDeviceRepository noiseDeviceRepository) {
        this.apiService = apiService;
        this.noiseDeviceRepository = noiseDeviceRepository;
    }

    // ─── Connection Management ───────────────────────────────────

    @PostMapping("/connect")
    @Operation(summary = "Configurer la connexion Tuya",
            description = "Teste la connexion avec les credentials du projet et enregistre le token")
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

            long deviceCount = noiseDeviceRepository.countByUserId(userId);
            statusDto.setDeviceCount(deviceCount);
        } else {
            statusDto.setConnected(false);
            statusDto.setStatus("NOT_CONNECTED");
            statusDto.setDeviceCount(0);
        }

        return ResponseEntity.ok(statusDto);
    }

    // ─── Device API Proxy ────────────────────────────────────────

    @GetMapping("/devices/{deviceId}")
    @Operation(summary = "Infos d'un device Tuya")
    public ResponseEntity<?> getDeviceInfo(@AuthenticationPrincipal Jwt jwt,
                                            @PathVariable String deviceId) {
        try {
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
        try {
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
        try {
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
