package com.clenzy.controller;

import com.clenzy.dto.thermostat.CreateThermostatDto;
import com.clenzy.dto.thermostat.ThermostatDto;
import com.clenzy.service.ThermostatService;
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
 * Gestion des thermostats connectes (Phase 2). Reutilise l'integration Tuya
 * pour la lecture (statut live) et le pilotage (consigne).
 */
@RestController
@RequestMapping("/api/thermostats")
@Tag(name = "Thermostats", description = "Gestion des thermostats connectes (Tuya)")
@PreAuthorize("isAuthenticated()")
public class ThermostatController {

    private static final Logger log = LoggerFactory.getLogger(ThermostatController.class);

    private final ThermostatService thermostatService;

    public ThermostatController(ThermostatService thermostatService) {
        this.thermostatService = thermostatService;
    }

    @GetMapping
    @Operation(summary = "Liste des thermostats de l'organisation")
    public ResponseEntity<List<ThermostatDto>> getThermostats(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(thermostatService.getUserThermostats(jwt.getSubject()));
    }

    @PostMapping
    @Operation(summary = "Ajouter un thermostat")
    public ResponseEntity<?> createThermostat(@AuthenticationPrincipal Jwt jwt,
                                              @Valid @RequestBody CreateThermostatDto dto) {
        try {
            return ResponseEntity.ok(thermostatService.createThermostat(jwt.getSubject(), dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un thermostat")
    public ResponseEntity<?> deleteThermostat(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        try {
            thermostatService.deleteThermostat(jwt.getSubject(), id);
            return ResponseEntity.ok(Map.of("status", "ok"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @GetMapping("/{id}/status")
    @Operation(summary = "Statut live (temperature/humidite/mode) via Tuya")
    public ResponseEntity<?> getStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        try {
            return ResponseEntity.ok(thermostatService.refreshStatus(jwt.getSubject(), id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @PostMapping("/{id}/target")
    @Operation(summary = "Definir la consigne (°C) via Tuya")
    public ResponseEntity<?> setTarget(@AuthenticationPrincipal Jwt jwt,
                                       @PathVariable Long id,
                                       @RequestParam double targetTempC) {
        try {
            return ResponseEntity.ok(thermostatService.setTargetTemp(jwt.getSubject(), id, targetTempC));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}
