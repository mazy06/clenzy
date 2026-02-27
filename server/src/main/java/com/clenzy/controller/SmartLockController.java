package com.clenzy.controller;

import com.clenzy.dto.smartlock.CreateSmartLockDeviceDto;
import com.clenzy.dto.smartlock.SmartLockDeviceDto;
import com.clenzy.service.SmartLockService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller pour la gestion des serrures connectees (Tuya Smart Lock).
 *
 * Endpoints :
 * - GET    /api/smart-locks             : liste des serrures
 * - POST   /api/smart-locks             : ajouter une serrure
 * - DELETE  /api/smart-locks/{id}       : supprimer une serrure
 * - GET    /api/smart-locks/{id}/status : statut live Tuya
 * - POST   /api/smart-locks/{id}/lock   : verrouiller
 * - POST   /api/smart-locks/{id}/unlock : deverrouiller
 */
@RestController
@RequestMapping("/api/smart-locks")
@Tag(name = "Smart Locks", description = "Gestion des serrures connectees Tuya")
@PreAuthorize("isAuthenticated()")
public class SmartLockController {

    private static final Logger log = LoggerFactory.getLogger(SmartLockController.class);

    private final SmartLockService smartLockService;

    public SmartLockController(SmartLockService smartLockService) {
        this.smartLockService = smartLockService;
    }

    // ─── CRUD ────────────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Liste des serrures connectees",
            description = "Retourne toutes les serrures configurees pour l'organisation")
    public ResponseEntity<List<SmartLockDeviceDto>> getUserDevices(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        List<SmartLockDeviceDto> devices = smartLockService.getUserDevices(userId);
        return ResponseEntity.ok(devices);
    }

    @PostMapping
    @Operation(summary = "Ajouter une serrure connectee",
            description = "Cree une nouvelle serrure liee a une propriete")
    public ResponseEntity<?> createDevice(@AuthenticationPrincipal Jwt jwt,
                                           @Valid @RequestBody CreateSmartLockDeviceDto dto) {
        String userId = jwt.getSubject();
        try {
            SmartLockDeviceDto device = smartLockService.createDevice(userId, dto);
            return ResponseEntity.ok(device);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "validation_error",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur creation serrure pour user {}: {}", userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la creation de la serrure"
            ));
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer une serrure connectee")
    public ResponseEntity<?> deleteDevice(@AuthenticationPrincipal Jwt jwt,
                                           @PathVariable Long id) {
        String userId = jwt.getSubject();
        try {
            smartLockService.deleteDevice(userId, id);
            return ResponseEntity.ok(Map.of(
                    "status", "deleted",
                    "message", "Serrure supprimee"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "not_found",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur suppression serrure {} pour user {}: {}", id, userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la suppression de la serrure"
            ));
        }
    }

    // ─── Lock Operations ──────────────────────────────────────────

    @GetMapping("/{id}/status")
    @Operation(summary = "Statut live d'une serrure",
            description = "Recupere le statut en temps reel via Tuya (locked/unlocked, batterie)")
    public ResponseEntity<?> getLockStatus(@AuthenticationPrincipal Jwt jwt,
                                            @PathVariable Long id) {
        String userId = jwt.getSubject();
        try {
            Map<String, Object> status = smartLockService.getLockStatus(userId, id);
            return ResponseEntity.ok(status);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "not_found",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur statut serrure {} pour user {}: {}", id, userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors de la recuperation du statut"
            ));
        }
    }

    @PostMapping("/{id}/lock")
    @Operation(summary = "Verrouiller une serrure",
            description = "Envoie la commande de verrouillage via Tuya")
    public ResponseEntity<?> lockDevice(@AuthenticationPrincipal Jwt jwt,
                                         @PathVariable Long id) {
        String userId = jwt.getSubject();
        try {
            smartLockService.sendLockCommand(userId, id, true);
            return ResponseEntity.ok(Map.of(
                    "status", "locked",
                    "message", "Serrure verrouillee"
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "command_error",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur verrouillage serrure {} pour user {}: {}", id, userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors du verrouillage"
            ));
        }
    }

    @PostMapping("/{id}/unlock")
    @Operation(summary = "Deverrouiller une serrure",
            description = "Envoie la commande de deverrouillage via Tuya")
    public ResponseEntity<?> unlockDevice(@AuthenticationPrincipal Jwt jwt,
                                           @PathVariable Long id) {
        String userId = jwt.getSubject();
        try {
            smartLockService.sendLockCommand(userId, id, false);
            return ResponseEntity.ok(Map.of(
                    "status", "unlocked",
                    "message", "Serrure deverrouillee"
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "command_error",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur deverrouillage serrure {} pour user {}: {}", id, userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "api_error",
                    "message", "Erreur lors du deverrouillage"
            ));
        }
    }
}
