package com.clenzy.controller;

import com.clenzy.service.DeviceTokenService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/devices")
@Tag(name = "Devices", description = "Gestion des tokens push mobile")
@PreAuthorize("isAuthenticated()")
public class DeviceTokenController {

    private final DeviceTokenService deviceTokenService;

    public DeviceTokenController(DeviceTokenService deviceTokenService) {
        this.deviceTokenService = deviceTokenService;
    }

    @PostMapping("/register")
    @Operation(summary = "Enregistrer un token push",
            description = "Enregistre le token FCM/Expo de l'appareil pour recevoir les notifications push.")
    public ResponseEntity<Map<String, String>> register(
            @Valid @RequestBody RegisterDeviceRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        deviceTokenService.register(userId, request.token(), request.platform());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("status", "registered"));
    }

    @DeleteMapping("/{token}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Desenregistrer un token push",
            description = "Supprime le token push de l'appareil (logout ou desinstallation).")
    public void unregister(@PathVariable String token) {
        deviceTokenService.unregister(token);
    }

    // ─── Request record ──────────────────────────────────────────────────────────

    public record RegisterDeviceRequest(
            @NotBlank String token,
            @NotBlank String platform
    ) {}
}
