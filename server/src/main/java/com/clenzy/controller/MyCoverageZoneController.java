package com.clenzy.controller;

import com.clenzy.service.IndividualCoverageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Zone d'intervention DECLAREE PAR L'INTERVENANT lui-meme.
 *
 * <p>Une déclaration portée par la personne, commune au PMS et à la marketplace.</p>
 */
@RestController
@RequestMapping("/api/my-coverage-zones")
@Tag(name = "Ma zone d'intervention")
@PreAuthorize("isAuthenticated()")
public class MyCoverageZoneController {

    private final IndividualCoverageService coverage;

    public MyCoverageZoneController(IndividualCoverageService coverage) {
        this.coverage = coverage;
    }

    @GetMapping
    @Operation(summary = "Ma zone d'intervention")
    public ResponseEntity<List<CoverageZoneDto>> getMine(@AuthenticationPrincipal Jwt jwt) {
        // Zone jamais declaree = liste vide, pas 404 : l'ecran affiche « non
        // declaree », ce qui n'est pas une erreur.
        return ResponseEntity.ok(coverage.getMine(jwt.getSubject()).stream()
                .map(CoverageZoneDto::from)
                .toList());
    }

    @PutMapping
    @Operation(summary = "Declarer ma zone d'intervention")
    public ResponseEntity<List<CoverageZoneDto>> replaceMine(
            @Valid @RequestBody List<CoverageZoneRequest> zones,
            @AuthenticationPrincipal Jwt jwt) {
        var saved = coverage.replace(
                jwt.getSubject(),
                zones.stream()
                        .map(z -> new IndividualCoverageService.Input(
                                z.country(), z.department(), z.arrondissement(), z.city()))
                        .toList());
        return ResponseEntity.ok(saved.stream().map(CoverageZoneDto::from).toList());
    }

    public record CoverageZoneRequest(
            @NotBlank @Size(min = 2, max = 2) String country,
            @Size(max = 3) String department,
            @Size(max = 5) String arrondissement,
            @Size(max = 100) String city) {}

    public record CoverageZoneDto(Long id, String country, String department,
                                  String arrondissement, String city) {
        static CoverageZoneDto from(IndividualCoverageService.Zone zone) {
            return new CoverageZoneDto(zone.id(), zone.country(),
                    zone.department(), zone.arrondissement(), zone.city());
        }
    }
}
