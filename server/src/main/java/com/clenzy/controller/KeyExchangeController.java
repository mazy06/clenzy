package com.clenzy.controller;

import com.clenzy.dto.keyexchange.*;
import com.clenzy.integration.keynest.KeyNestApiService;
import com.clenzy.service.KeyExchangeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller pour la gestion des echanges de cles (KeyNest + Clenzy KeyVault).
 *
 * Endpoints :
 * - GET    /api/key-exchange/points                        → liste des points
 * - POST   /api/key-exchange/points                        → creer un point
 * - DELETE /api/key-exchange/points/{id}                    → supprimer un point
 * - GET    /api/key-exchange/points/{id}/codes              → codes actifs d'un point
 * - POST   /api/key-exchange/codes                          → generer un code
 * - DELETE /api/key-exchange/codes/{id}                      → annuler un code
 * - GET    /api/key-exchange/events                         → historique pagine
 * - GET    /api/key-exchange/keynest/stores                 → recherche points KeyNest proches
 */
@RestController
@RequestMapping("/api/key-exchange")
@Tag(name = "Key Exchange", description = "Gestion des echanges de cles (KeyNest + Clenzy KeyVault)")
@PreAuthorize("isAuthenticated()")
public class KeyExchangeController {

    private static final Logger log = LoggerFactory.getLogger(KeyExchangeController.class);

    private final KeyExchangeService keyExchangeService;
    private final KeyNestApiService keyNestApiService;

    public KeyExchangeController(KeyExchangeService keyExchangeService,
                                  KeyNestApiService keyNestApiService) {
        this.keyExchangeService = keyExchangeService;
        this.keyNestApiService = keyNestApiService;
    }

    // ─── Points ──────────────────────────────────────────────────

    @GetMapping("/points")
    @Operation(summary = "Liste des points d'echange",
            description = "Retourne tous les points configures pour l'organisation")
    public ResponseEntity<List<KeyExchangePointDto>> getPoints(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ResponseEntity.ok(keyExchangeService.getPoints(userId));
    }

    @PostMapping("/points")
    @Operation(summary = "Creer un point d'echange",
            description = "Cree un nouveau point lie a une propriete (KeyNest ou Clenzy KeyVault)")
    public ResponseEntity<?> createPoint(@AuthenticationPrincipal Jwt jwt,
                                          @Valid @RequestBody CreateKeyExchangePointDto dto) {
        String userId = jwt.getSubject();
        try {
            KeyExchangePointDto point = keyExchangeService.createPoint(userId, dto);
            return ResponseEntity.ok(point);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "validation_error",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur creation point d'echange pour user {}: {}", userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la creation du point d'echange"
            ));
        }
    }

    @DeleteMapping("/points/{id}")
    @Operation(summary = "Supprimer un point d'echange")
    public ResponseEntity<?> deletePoint(@AuthenticationPrincipal Jwt jwt,
                                          @PathVariable Long id) {
        String userId = jwt.getSubject();
        try {
            keyExchangeService.deletePoint(userId, id);
            return ResponseEntity.ok(Map.of(
                    "status", "deleted",
                    "message", "Point d'echange supprime"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "not_found",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur suppression point {} pour user {}: {}", id, userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la suppression du point d'echange"
            ));
        }
    }

    // ─── Codes ──────────────────────────────────────────────────

    @GetMapping("/points/{pointId}/codes")
    @Operation(summary = "Codes actifs d'un point d'echange")
    public ResponseEntity<List<KeyExchangeCodeDto>> getActiveCodesByPoint(@PathVariable Long pointId) {
        return ResponseEntity.ok(keyExchangeService.getActiveCodesByPoint(pointId));
    }

    @PostMapping("/codes")
    @Operation(summary = "Generer un code d'echange",
            description = "Genere un nouveau code (Clenzy: 6 chiffres, KeyNest: via API)")
    public ResponseEntity<?> generateCode(@AuthenticationPrincipal Jwt jwt,
                                           @Valid @RequestBody CreateKeyExchangeCodeDto dto) {
        String userId = jwt.getSubject();
        try {
            KeyExchangeCodeDto code = keyExchangeService.generateCode(userId, dto);
            return ResponseEntity.ok(code);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "validation_error",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur generation code pour user {}: {}", userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la generation du code"
            ));
        }
    }

    @DeleteMapping("/codes/{id}")
    @Operation(summary = "Annuler un code d'echange")
    public ResponseEntity<?> cancelCode(@AuthenticationPrincipal Jwt jwt,
                                         @PathVariable Long id) {
        String userId = jwt.getSubject();
        try {
            keyExchangeService.cancelCode(userId, id);
            return ResponseEntity.ok(Map.of(
                    "status", "cancelled",
                    "message", "Code annule"
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "validation_error",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur annulation code {} pour user {}: {}", id, userId, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de l'annulation du code"
            ));
        }
    }

    // ─── Events ─────────────────────────────────────────────────

    @GetMapping("/events")
    @Operation(summary = "Historique des evenements",
            description = "Retourne les evenements d'echange de cles pagines")
    public ResponseEntity<Page<KeyExchangeEventDto>> getEvents(
            @RequestParam(required = false) Long propertyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(keyExchangeService.getEvents(propertyId, page, size));
    }

    // ─── KeyNest stores ──────────────────────────────────────────

    @GetMapping("/keynest/stores")
    @Operation(summary = "Rechercher les points KeyNest proches",
            description = "Recherche les points de depot KeyNest par coordonnees GPS")
    public ResponseEntity<?> searchKeyNestStores(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "5") double radius) {
        try {
            List<KeyNestStoreDto> stores = keyNestApiService.searchStores(lat, lng, radius);
            return ResponseEntity.ok(stores);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "not_configured",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Erreur recherche stores KeyNest (lat={}, lng={}): {}", lat, lng, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "server_error",
                    "message", "Erreur lors de la recherche des points KeyNest"
            ));
        }
    }
}
