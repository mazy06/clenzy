package com.clenzy.integration.airbnb.controller;

import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.service.AirbnbListingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller pour la gestion des listings Airbnb.
 *
 * Endpoints :
 * - GET    /api/airbnb/listings           : lister les listings lies
 * - POST   /api/airbnb/listings/link      : lier une propriete a un listing
 * - DELETE /api/airbnb/listings/{id}/unlink: delier une propriete
 * - PUT    /api/airbnb/listings/{id}/sync  : activer/desactiver la sync
 */
@RestController
@RequestMapping("/api/airbnb/listings")
@Tag(name = "Airbnb Listings", description = "Gestion des annonces Airbnb liees")
public class AirbnbListingController {

    private static final Logger log = LoggerFactory.getLogger(AirbnbListingController.class);

    private final AirbnbListingService listingService;

    public AirbnbListingController(AirbnbListingService listingService) {
        this.listingService = listingService;
    }

    @GetMapping
    @Operation(summary = "Lister les listings Airbnb lies",
            description = "Retourne tous les mappings propriete <-> listing Airbnb actifs")
    public ResponseEntity<List<AirbnbListingMapping>> getLinkedListings() {
        return ResponseEntity.ok(listingService.getActiveListings());
    }

    @PostMapping("/link")
    @Operation(summary = "Lier une propriete a un listing Airbnb",
            description = "Cree le mapping entre une propriete Clenzy et un listing Airbnb")
    public ResponseEntity<?> linkProperty(@RequestBody Map<String, Object> request) {
        try {
            Long propertyId = Long.valueOf(request.get("propertyId").toString());
            String airbnbListingId = (String) request.get("airbnbListingId");
            String airbnbListingTitle = (String) request.get("airbnbListingTitle");
            String airbnbListingUrl = (String) request.get("airbnbListingUrl");

            if (propertyId == null || airbnbListingId == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "missing_fields",
                        "message", "propertyId et airbnbListingId sont requis"
                ));
            }

            AirbnbListingMapping mapping = listingService.linkPropertyToListing(
                    propertyId, airbnbListingId, airbnbListingTitle, airbnbListingUrl);

            return ResponseEntity.ok(mapping);

        } catch (RuntimeException e) {
            log.error("Erreur liaison listing: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "link_failed",
                    "message", e.getMessage()
            ));
        }
    }

    @DeleteMapping("/{propertyId}/unlink")
    @Operation(summary = "Delier une propriete d'un listing Airbnb")
    public ResponseEntity<Map<String, String>> unlinkProperty(@PathVariable Long propertyId) {
        try {
            listingService.unlinkProperty(propertyId);
            return ResponseEntity.ok(Map.of(
                    "status", "unlinked",
                    "message", "Propriete deliee du listing Airbnb"
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "unlink_failed",
                    "message", e.getMessage()
            ));
        }
    }

    @PutMapping("/{propertyId}/sync")
    @Operation(summary = "Activer/desactiver la sync pour un listing")
    public ResponseEntity<?> toggleSync(
            @PathVariable Long propertyId,
            @RequestParam boolean enabled) {
        try {
            AirbnbListingMapping mapping = listingService.toggleSync(propertyId, enabled);
            return ResponseEntity.ok(mapping);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "toggle_failed",
                    "message", e.getMessage()
            ));
        }
    }

    @PutMapping("/{propertyId}/auto-interventions")
    @Operation(summary = "Activer/desactiver la creation automatique d'interventions")
    public ResponseEntity<?> toggleAutoInterventions(
            @PathVariable Long propertyId,
            @RequestParam boolean enabled) {
        try {
            AirbnbListingMapping mapping = listingService.toggleAutoInterventions(propertyId, enabled);
            return ResponseEntity.ok(mapping);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "toggle_failed",
                    "message", e.getMessage()
            ));
        }
    }
}
