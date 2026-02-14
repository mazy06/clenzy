package com.clenzy.controller;

import com.clenzy.dto.ICalImportDto.*;
import com.clenzy.service.ICalImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ical")
@Tag(name = "iCal Import", description = "Import et synchronisation de calendriers iCal (Airbnb, Booking, Vrbo, etc.)")
public class ICalImportController {

    private final ICalImportService iCalImportService;

    public ICalImportController(ICalImportService iCalImportService) {
        this.iCalImportService = iCalImportService;
    }

    @PostMapping("/preview")
    @Operation(summary = "Previsualiser un flux iCal sans import",
            description = "Telecharge et parse le fichier .ics pour afficher les reservations trouvees. Forfait Confort ou Premium requis.")
    public ResponseEntity<PreviewResponse> preview(@RequestBody PreviewRequest request,
                                                    @AuthenticationPrincipal Jwt jwt) {
        checkForfaitAccess(jwt);
        PreviewResponse response = iCalImportService.previewICalFeed(request.getUrl(), request.getPropertyId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/import")
    @Operation(summary = "Importer les reservations depuis un flux iCal",
            description = "Parse le .ics, cree les interventions de menage et sauvegarde le feed. Forfait Confort ou Premium requis.")
    public ResponseEntity<ImportResponse> importFeed(@RequestBody ImportRequest request,
                                                      @AuthenticationPrincipal Jwt jwt) {
        checkForfaitAccess(jwt);
        ImportResponse response = iCalImportService.importICalFeed(request, jwt.getSubject());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/feeds")
    @Operation(summary = "Lister les feeds iCal de l'utilisateur",
            description = "Retourne tous les feeds iCal associes aux proprietes de l'utilisateur connecte.")
    public ResponseEntity<List<FeedDto>> getFeeds(@AuthenticationPrincipal Jwt jwt) {
        checkForfaitAccess(jwt);
        List<FeedDto> feeds = iCalImportService.getUserFeeds(jwt.getSubject());
        return ResponseEntity.ok(feeds);
    }

    @DeleteMapping("/feeds/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer un feed iCal",
            description = "Supprime un feed iCal. Seul le proprietaire du logement peut supprimer.")
    public void deleteFeed(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        iCalImportService.deleteFeed(id, jwt.getSubject());
    }

    @PutMapping("/feeds/{id}/toggle-auto")
    @Operation(summary = "Activer/desactiver l'auto-creation de menage",
            description = "Bascule le toggle de creation automatique d'interventions pour un feed iCal. Forfait Confort ou Premium requis.")
    public ResponseEntity<FeedDto> toggleAutoInterventions(@PathVariable Long id,
                                                            @AuthenticationPrincipal Jwt jwt) {
        checkForfaitAccess(jwt);
        FeedDto feed = iCalImportService.toggleAutoInterventions(id, jwt.getSubject());
        return ResponseEntity.ok(feed);
    }

    @PostMapping("/feeds/{id}/sync")
    @Operation(summary = "Forcer la synchronisation d'un feed iCal",
            description = "Re-importe les reservations depuis le feed avec dedoublonnage. Seul le proprietaire peut declencher la synchro.")
    public ResponseEntity<ImportResponse> syncFeed(@PathVariable Long id,
                                                    @AuthenticationPrincipal Jwt jwt) {
        ImportResponse response = iCalImportService.syncFeed(id, jwt.getSubject());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/check-access")
    @Operation(summary = "Verifier si l'utilisateur a acces a l'import iCal",
            description = "Retourne true si le forfait de l'utilisateur permet l'import iCal (Confort ou Premium).")
    public ResponseEntity<Map<String, Boolean>> checkAccess(@AuthenticationPrincipal Jwt jwt) {
        boolean allowed = iCalImportService.isUserAllowed(jwt.getSubject());
        return ResponseEntity.ok(Map.of("allowed", allowed));
    }

    /**
     * Verifie que l'utilisateur a un forfait adequat pour acceder a l'import iCal.
     */
    private void checkForfaitAccess(Jwt jwt) {
        if (!iCalImportService.isUserAllowed(jwt.getSubject())) {
            throw new SecurityException("Votre forfait ne permet pas l'import iCal. Forfait Confort ou Premium requis.");
        }
    }
}
