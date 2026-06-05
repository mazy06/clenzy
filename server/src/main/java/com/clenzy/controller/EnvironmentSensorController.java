package com.clenzy.controller;

import com.clenzy.dto.environment.CreateEnvironmentSensorDto;
import com.clenzy.dto.environment.EnvironmentSensorDto;
import com.clenzy.service.EnvironmentSensorService;
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
 * Gestion des capteurs d'environnement (temp/humidite, contact, mouvement, fumee).
 * Reutilise l'integration Tuya pour la lecture d'etat. Modele generique unique
 * cote service ({@code sensorType} discriminant).
 */
@RestController
@RequestMapping("/api/environment-sensors")
@Tag(name = "Capteurs d'environnement", description = "Capteurs Tuya/Zigbee (temp/humidite, contact, mouvement, fumee)")
@PreAuthorize("isAuthenticated()")
public class EnvironmentSensorController {

    private static final Logger log = LoggerFactory.getLogger(EnvironmentSensorController.class);

    private final EnvironmentSensorService sensorService;

    public EnvironmentSensorController(EnvironmentSensorService sensorService) {
        this.sensorService = sensorService;
    }

    @GetMapping
    @Operation(summary = "Liste des capteurs d'environnement de l'organisation")
    public ResponseEntity<List<EnvironmentSensorDto>> getSensors(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(sensorService.getUserSensors(jwt.getSubject()));
    }

    @PostMapping
    @Operation(summary = "Ajouter un capteur d'environnement")
    public ResponseEntity<?> createSensor(@AuthenticationPrincipal Jwt jwt,
                                          @Valid @RequestBody CreateEnvironmentSensorDto dto) {
        try {
            return ResponseEntity.ok(sensorService.createSensor(jwt.getSubject(), dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un capteur d'environnement")
    public ResponseEntity<?> deleteSensor(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        try {
            sensorService.deleteSensor(jwt.getSubject(), id);
            return ResponseEntity.ok(Map.of("status", "ok"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @PostMapping("/{id}/refresh")
    @Operation(summary = "Rafraichir l'etat (via Tuya)")
    public ResponseEntity<?> refresh(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        try {
            return ResponseEntity.ok(sensorService.refreshStatus(jwt.getSubject(), id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}
