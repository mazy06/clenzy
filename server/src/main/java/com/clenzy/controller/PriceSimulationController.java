package com.clenzy.controller;

import com.clenzy.dto.PriceBreakdownDto;
import com.clenzy.dto.PriceSimulationRequest;
import com.clenzy.service.PriceSimulationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Simulation de prix TTC par pays (CLZ-P0-18) — controller mince (audit #4) : délègue au
 * {@link PriceSimulationService}, qui recalcule l'hébergement HT côté serveur (audit #1) et
 * valide l'ownership du bien (audit #3).
 */
@RestController
@RequestMapping("/api/pricing")
@PreAuthorize("isAuthenticated()")
public class PriceSimulationController {

    private final PriceSimulationService priceSimulationService;

    public PriceSimulationController(PriceSimulationService priceSimulationService) {
        this.priceSimulationService = priceSimulationService;
    }

    @PostMapping("/simulate")
    public ResponseEntity<PriceBreakdownDto> simulate(@RequestBody PriceSimulationRequest request) {
        return ResponseEntity.ok(priceSimulationService.simulate(request));
    }
}
