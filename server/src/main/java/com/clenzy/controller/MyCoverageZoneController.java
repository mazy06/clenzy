package com.clenzy.controller;

import com.clenzy.model.TeamCoverageZone;
import com.clenzy.service.PersonalTeamService;
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
 * <p>Les zones vivent dans {@code team_coverage_zones}, clefees par equipe :
 * c'est ce que lit le moteur d'affectation. Un intervenant independant passe
 * donc par son equipe PERSONNELLE, creee au premier enregistrement — d'ou
 * {@link PersonalTeamService}, qui porte toute la logique. Le controller se
 * limite a valider l'entree et a convertir la sortie (regle ArchUnit gelee :
 * aucun repository ici).</p>
 *
 * <p>Un intervenant deja membre d'une equipe classique garde SA zone
 * personnelle : les deux coexistent, et le moteur retient l'une ou l'autre
 * selon ce qui couvre le logement.</p>
 */
@RestController
@RequestMapping("/api/my-coverage-zones")
@Tag(name = "Ma zone d'intervention")
@PreAuthorize("isAuthenticated()")
public class MyCoverageZoneController {

    private final PersonalTeamService personalTeamService;

    public MyCoverageZoneController(PersonalTeamService personalTeamService) {
        this.personalTeamService = personalTeamService;
    }

    @GetMapping
    @Operation(summary = "Ma zone d'intervention")
    public ResponseEntity<List<CoverageZoneDto>> getMine(@AuthenticationPrincipal Jwt jwt) {
        // Zone jamais declaree = liste vide, pas 404 : l'ecran affiche « non
        // declaree », ce qui n'est pas une erreur.
        return ResponseEntity.ok(personalTeamService.getCoverageZones(jwt.getSubject()).stream()
                .map(CoverageZoneDto::from)
                .toList());
    }

    @PutMapping
    @Operation(summary = "Declarer ma zone d'intervention")
    public ResponseEntity<List<CoverageZoneDto>> replaceMine(
            @Valid @RequestBody List<CoverageZoneRequest> zones,
            @AuthenticationPrincipal Jwt jwt) {
        List<TeamCoverageZone> saved = personalTeamService.replaceCoverageZones(
                jwt.getSubject(),
                zones.stream()
                        .map(z -> new PersonalTeamService.CoverageZoneInput(
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
        static CoverageZoneDto from(TeamCoverageZone zone) {
            return new CoverageZoneDto(zone.getId(), zone.getCountry(),
                    zone.getDepartment(), zone.getArrondissement(), zone.getCity());
        }
    }
}
