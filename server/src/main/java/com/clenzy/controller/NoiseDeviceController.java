package com.clenzy.controller;

import com.clenzy.dto.noise.CreateNoiseDeviceDto;
import com.clenzy.dto.noise.NoiseChartDataDto;
import com.clenzy.dto.noise.NoiseDataPointDto;
import com.clenzy.dto.noise.NoiseDeviceDto;
import com.clenzy.service.NoiseDeviceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * Controller unifie pour la gestion des capteurs de bruit.
 *
 * Endpoints :
 * - GET    /api/noise-devices           : liste des capteurs
 * - POST   /api/noise-devices           : ajouter un capteur
 * - DELETE  /api/noise-devices/{id}     : supprimer un capteur
 * - GET    /api/noise-devices/{id}/data : donnees bruit d'un capteur
 * - GET    /api/noise-devices/data      : donnees agregees tous capteurs
 */
@RestController
@RequestMapping("/api/noise-devices")
@Tag(name = "Noise Devices", description = "Gestion des capteurs de bruit (Minut + Tuya)")
@PreAuthorize("isAuthenticated()")
public class NoiseDeviceController {

    private static final Logger log = LoggerFactory.getLogger(NoiseDeviceController.class);

    private final NoiseDeviceService noiseDeviceService;

    public NoiseDeviceController(NoiseDeviceService noiseDeviceService) {
        this.noiseDeviceService = noiseDeviceService;
    }

    // ─── CRUD ────────────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Liste des capteurs de bruit",
            description = "Retourne tous les capteurs configures pour l'utilisateur")
    public ResponseEntity<List<NoiseDeviceDto>> getUserDevices(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();

        List<NoiseDeviceDto> devices = noiseDeviceService.getUserDevices(userId);
        return ResponseEntity.ok(devices);
    }

    @PostMapping
    @Operation(summary = "Ajouter un capteur de bruit",
            description = "Cree un nouveau capteur lie a une propriete")
    public ResponseEntity<?> createDevice(@AuthenticationPrincipal Jwt jwt,
                                           @Valid @RequestBody CreateNoiseDeviceDto dto) {
        String userId = jwt.getSubject();

        try {
            NoiseDeviceDto device = noiseDeviceService.createDevice(userId, dto);
            return ResponseEntity.ok(device);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "validation_error",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur creation capteur pour user {}: {}", userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la creation du capteur"
            ));
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un capteur de bruit")
    public ResponseEntity<?> deleteDevice(@AuthenticationPrincipal Jwt jwt,
                                           @PathVariable Long id) {
        String userId = jwt.getSubject();

        try {
            noiseDeviceService.deleteDevice(userId, id);
            return ResponseEntity.ok(Map.of(
                    "status", "deleted",
                    "message", "Capteur supprime"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "not_found",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur suppression capteur {} pour user {}: {}", id, userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la suppression du capteur"
            ));
        }
    }

    // ─── Noise Data ──────────────────────────────────────────────

    @GetMapping("/{id}/data")
    @Operation(summary = "Donnees bruit d'un capteur",
            description = "Recupere les donnees de bruit d'un capteur specifique")
    public ResponseEntity<?> getNoiseData(@AuthenticationPrincipal Jwt jwt,
                                           @PathVariable Long id,
                                           @RequestParam(required = false) String start,
                                           @RequestParam(required = false) String end) {
        String userId = jwt.getSubject();

        try {
            List<NoiseDataPointDto> data = noiseDeviceService.getNoiseData(userId, id, start, end);
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "not_found",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur recuperation donnees bruit capteur {} pour user {}: {}", id, userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la recuperation des donnees"
            ));
        }
    }

    @GetMapping("/data")
    @Operation(summary = "Donnees bruit agregees",
            description = "Recupere les donnees de bruit agregees de tous les capteurs de l'utilisateur")
    public ResponseEntity<?> getAllNoiseData(@AuthenticationPrincipal Jwt jwt,
                                             @RequestParam(required = false) String start,
                                             @RequestParam(required = false) String end) {
        String userId = jwt.getSubject();

        try {
            NoiseChartDataDto chartData = noiseDeviceService.getAllNoiseData(userId, start, end);
            return ResponseEntity.ok(chartData);
        } catch (Exception e) {
            log.error("Erreur recuperation donnees bruit agregees pour user {}: {}", userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la recuperation des donnees agregees"
            ));
        }
    }
}
