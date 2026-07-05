package com.clenzy.controller;

import com.clenzy.service.DevConstellationDemoService;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Endpoint de TEST — profils NON-prod uniquement ({@code @Profile}) : fait
 * apparaître une carte HITL de démo sur la constellation d'un logement en
 * exerçant un VRAI flux déterministe (escalade bruit → {@code SUGGEST_CALENDAR_BLOCK}),
 * SANS caution ni annulation de réservation.
 *
 * <p>N'existe PAS en production (bean non enregistré sous le profil {@code prod}).
 * Réservé au staff plateforme. Controller mince : délègue au service.</p>
 */
@RestController
@RequestMapping("/api/dev/constellation")
@Profile({"dev", "local"})
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class DevConstellationDemoController {

    private final DevConstellationDemoService demoService;

    public DevConstellationDemoController(DevConstellationDemoService demoService) {
        this.demoService = demoService;
    }

    /**
     * POST /api/dev/constellation/demo-card?propertyId=X — simule une escalade de
     * bruit → carte HITL « Bloquer le calendrier » (domaine Opérations) sur la
     * constellation du logement.
     */
    @PostMapping("/demo-card")
    public ResponseEntity<Map<String, Object>> demoCard(@RequestParam Long propertyId) {
        demoService.spawnDemoCard(propertyId);
        return ResponseEntity.ok(Map.of(
                "ok", true,
                "propertyId", propertyId,
                "message", "Carte HITL de démo créée sur la constellation (Opérations · bloquer le calendrier)."));
    }
}
