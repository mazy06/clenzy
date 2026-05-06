package com.clenzy.controller;

import com.clenzy.service.GeocodingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Endpoints admin pour le geocodage (Nominatim).
 * Reserve aux SUPER_ADMIN car batch potentiellement long et impactant.
 */
@RestController
@RequestMapping("/api/admin/geocoding")
@Tag(name = "Geocoding Administration", description = "Retro-geocodage des proprietes existantes")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class GeocodingAdminController {

    private final GeocodingService geocodingService;

    public GeocodingAdminController(GeocodingService geocodingService) {
        this.geocodingService = geocodingService;
    }

    @PostMapping("/retro")
    @Operation(summary = "Rattrape les coordonnees GPS des proprietes existantes",
            description = "Parcourt toutes les proprietes sans lat/lon et tente de les geocoder via Nominatim. " +
                    "Operation potentiellement longue (1 req/sec, donc N proprietes = N secondes minimum).")
    public ResponseEntity<Map<String, Object>> retroGeocodeAll() {
        GeocodingService.RetroGeocodeReport report = geocodingService.retroGeocodeMissing();
        return ResponseEntity.ok(Map.of(
                "total", report.total(),
                "updated", report.updated(),
                "skipped", report.skipped(),
                "failed", report.failed()
        ));
    }
}
