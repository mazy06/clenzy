package com.clenzy.controller;

import com.clenzy.dto.RateOverrideDto;
import com.clenzy.service.RateOverrideService;
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
 * Endpoints des overrides de prix par date (priorite maximale).
 *
 * Controller mince (audit T-ARCH-01) : validation d'acces propriete,
 * acces donnees et transactions au niveau {@link RateOverrideService}.
 */
@RestController
@RequestMapping("/api/rate-overrides")
@Tag(name = "Rate Overrides", description = "Prix specifiques par date (priorite maximale)")
@PreAuthorize("isAuthenticated()")
public class RateOverrideController {

    private final RateOverrideService rateOverrideService;

    public RateOverrideController(RateOverrideService rateOverrideService) {
        this.rateOverrideService = rateOverrideService;
    }

    @GetMapping
    @Operation(summary = "Overrides de prix pour une propriete et une periode")
    public ResponseEntity<List<RateOverrideDto>> getByPropertyAndRange(
            @RequestParam Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(
                rateOverrideService.getByPropertyAndRange(propertyId, from, to, jwt.getSubject()));
    }

    @PostMapping
    @Operation(summary = "Creer un override de prix")
    public ResponseEntity<RateOverrideDto> create(
            @RequestBody RateOverrideDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateOverrideService.create(dto, jwt.getSubject()));
    }

    @PostMapping("/bulk")
    @Operation(summary = "Creer des overrides en lot sur une plage de dates")
    public ResponseEntity<Map<String, Object>> createBulk(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(rateOverrideService.createBulk(body, jwt.getSubject()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un override de prix")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        rateOverrideService.delete(id, jwt.getSubject());
        return ResponseEntity.noContent().build();
    }
}
