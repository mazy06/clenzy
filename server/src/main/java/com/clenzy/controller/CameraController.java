package com.clenzy.controller;

import com.clenzy.dto.camera.CameraDto;
import com.clenzy.dto.camera.CreateCameraDto;
import com.clenzy.service.CameraService;
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
 * Gestion des cameras connectees (Phase 2). Le streaming est servi par la
 * passerelle media go2rtc ; ce controller gere le CRUD des cameras.
 */
@RestController
@RequestMapping("/api/cameras")
@Tag(name = "Cameras", description = "Gestion des cameras connectees (Phase 2)")
@PreAuthorize("isAuthenticated()")
public class CameraController {

    private static final Logger log = LoggerFactory.getLogger(CameraController.class);

    private final CameraService cameraService;

    public CameraController(CameraService cameraService) {
        this.cameraService = cameraService;
    }

    @GetMapping
    @Operation(summary = "Liste des cameras de l'organisation")
    public ResponseEntity<List<CameraDto>> getCameras(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(cameraService.getUserCameras(jwt.getSubject()));
    }

    @PostMapping
    @Operation(summary = "Ajouter une camera")
    public ResponseEntity<?> createCamera(@AuthenticationPrincipal Jwt jwt,
                                          @Valid @RequestBody CreateCameraDto dto) {
        try {
            return ResponseEntity.ok(cameraService.createCamera(jwt.getSubject(), dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer une camera")
    public ResponseEntity<?> deleteCamera(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        try {
            cameraService.deleteCamera(jwt.getSubject(), id);
            return ResponseEntity.ok(Map.of("status", "ok"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}
