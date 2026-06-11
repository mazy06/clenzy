package com.clenzy.controller;

import com.clenzy.dto.MinNightsOverrideDto;
import com.clenzy.service.MinNightsOverrideService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Endpoints des overrides de minimum de nuits par date.
 *
 * Controller mince (audit T-ARCH-01) : validation d'acces propriete,
 * acces donnees et transactions au niveau {@link MinNightsOverrideService}.
 */
@RestController
@RequestMapping("/api/min-nights-overrides")
@Tag(name = "Min Nights Overrides",
     description = "Surcharge du minimum de nuits par date (priorite sur le defaut propriete)")
@PreAuthorize("isAuthenticated()")
public class MinNightsOverrideController {

    private final MinNightsOverrideService minNightsOverrideService;

    public MinNightsOverrideController(MinNightsOverrideService minNightsOverrideService) {
        this.minNightsOverrideService = minNightsOverrideService;
    }

    @GetMapping
    @Operation(summary = "Overrides de min-nights pour une propriete et une periode")
    public ResponseEntity<List<MinNightsOverrideDto>> getByPropertyAndRange(
            @RequestParam Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(
                minNightsOverrideService.getByPropertyAndRange(propertyId, from, to, jwt.getSubject()));
    }

    @PostMapping
    @Operation(summary = "Creer un override de min-nights")
    public ResponseEntity<MinNightsOverrideDto> create(
            @RequestBody MinNightsOverrideDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(minNightsOverrideService.create(dto, jwt.getSubject()));
    }

    @PostMapping("/bulk")
    @Operation(summary = "Creer des overrides en lot sur une plage de dates (upsert)")
    public ResponseEntity<Map<String, Object>> createBulk(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(minNightsOverrideService.createBulk(body, jwt.getSubject()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un override de min-nights")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        minNightsOverrideService.delete(id, jwt.getSubject());
        return ResponseEntity.noContent().build();
    }
}
