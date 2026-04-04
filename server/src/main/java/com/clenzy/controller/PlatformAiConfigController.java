package com.clenzy.controller;

import com.clenzy.dto.PlatformAiModelDto;
import com.clenzy.dto.SavePlatformModelRequest;
import com.clenzy.dto.TestPlatformModelRequest;
import com.clenzy.service.PlatformAiConfigService;
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
 * Controller pour la configuration IA multi-modeles au niveau plateforme.
 * Accessible uniquement par les SUPER_ADMIN.
 */
@RestController
@RequestMapping("/api/admin/ai/platform-config")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class PlatformAiConfigController {

    private static final Logger log = LoggerFactory.getLogger(PlatformAiConfigController.class);

    private final PlatformAiConfigService configService;

    public PlatformAiConfigController(PlatformAiConfigService configService) {
        this.configService = configService;
    }

    // ─── Models CRUD ────────────────────────────────────────────────────

    @GetMapping("/models")
    public ResponseEntity<List<PlatformAiModelDto>> getModels() {
        return ResponseEntity.ok(configService.getModels());
    }

    @PostMapping("/models")
    public ResponseEntity<PlatformAiModelDto> saveModel(
            @Valid @RequestBody SavePlatformModelRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        String updatedBy = jwt.getClaimAsString("preferred_username");
        PlatformAiModelDto result = configService.saveModel(request, updatedBy);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/models/{id}")
    public ResponseEntity<PlatformAiModelDto> updateModel(
            @PathVariable Long id,
            @Valid @RequestBody SavePlatformModelRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        String updatedBy = jwt.getClaimAsString("preferred_username");
        // Ensure the ID from the path is used
        SavePlatformModelRequest withId = new SavePlatformModelRequest(
                id, request.name(), request.provider(), request.modelId(),
                request.apiKey(), request.baseUrl());
        PlatformAiModelDto result = configService.saveModel(withId, updatedBy);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/models/{id}")
    public ResponseEntity<Map<String, String>> deleteModel(@PathVariable Long id) {
        configService.deleteModel(id);
        return ResponseEntity.ok(Map.of("message", "Model deleted"));
    }

    @PostMapping("/models/test")
    public ResponseEntity<Map<String, Object>> testModel(
            @Valid @RequestBody TestPlatformModelRequest request) {
        boolean success = configService.testModel(request);
        return ResponseEntity.ok(Map.of(
                "success", success,
                "provider", request.provider(),
                "modelId", request.modelId()
        ));
    }

    // ─── Feature Assignments ────────────────────────────────────────────

    @GetMapping("/features")
    public ResponseEntity<Map<String, PlatformAiModelDto>> getFeatureAssignments() {
        return ResponseEntity.ok(configService.getFeatureAssignments());
    }

    @PutMapping("/features/{feature}/model/{modelId}")
    public ResponseEntity<Map<String, String>> assignModelToFeature(
            @PathVariable String feature, @PathVariable Long modelId) {
        configService.assignModelToFeature(modelId, feature);
        return ResponseEntity.ok(Map.of("message", "Feature " + feature + " assigned to model " + modelId));
    }

    @DeleteMapping("/features/{feature}")
    public ResponseEntity<Map<String, String>> unassignFeature(@PathVariable String feature) {
        configService.unassignFeature(feature);
        return ResponseEntity.ok(Map.of("message", "Feature " + feature + " unassigned"));
    }

    // ─── Token Budget per feature ──────────────────────────────────────

    @GetMapping("/budgets")
    public ResponseEntity<Map<String, Long>> getFeatureBudgets() {
        return ResponseEntity.ok(configService.getFeatureBudgets());
    }

    @PutMapping("/budgets/{feature}")
    public ResponseEntity<Map<String, Object>> setFeatureBudget(
            @PathVariable String feature,
            @RequestBody Map<String, Long> body) {
        long limit = body.getOrDefault("limit", 100_000L);
        configService.setFeatureBudget(feature, limit);
        return ResponseEntity.ok(Map.of("feature", feature, "limit", limit));
    }
}
