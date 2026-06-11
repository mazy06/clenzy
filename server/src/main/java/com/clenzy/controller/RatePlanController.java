package com.clenzy.controller;

import com.clenzy.dto.RatePlanDto;
import com.clenzy.service.RatePlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Endpoints des plans tarifaires par propriete.
 *
 * Controller mince (audit T-ARCH-01) : validation d'acces propriete,
 * acces donnees et transactions au niveau {@link RatePlanService}.
 */
@RestController
@RequestMapping("/api/rate-plans")
@Tag(name = "Rate Plans", description = "Gestion des plans tarifaires par propriete")
@PreAuthorize("isAuthenticated()")
public class RatePlanController {

    private final RatePlanService ratePlanService;

    public RatePlanController(RatePlanService ratePlanService) {
        this.ratePlanService = ratePlanService;
    }

    @GetMapping
    @Operation(summary = "Plans tarifaires d'une propriete")
    public ResponseEntity<List<RatePlanDto>> getByProperty(
            @RequestParam Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(ratePlanService.getByProperty(propertyId, jwt.getSubject()));
    }

    @PostMapping
    @Operation(summary = "Creer un plan tarifaire")
    public ResponseEntity<RatePlanDto> create(
            @RequestBody RatePlanDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(ratePlanService.create(dto, jwt.getSubject()));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Modifier un plan tarifaire")
    public ResponseEntity<RatePlanDto> update(
            @PathVariable Long id,
            @RequestBody RatePlanDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(ratePlanService.update(id, dto, jwt.getSubject()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprimer un plan tarifaire")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        ratePlanService.delete(id, jwt.getSubject());
        return ResponseEntity.noContent().build();
    }
}
