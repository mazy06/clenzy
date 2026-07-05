package com.clenzy.controller;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.service.PricingConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pricing-config")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
public class PricingConfigController {

    private static final Logger log = LoggerFactory.getLogger(PricingConfigController.class);

    private final PricingConfigService pricingConfigService;

    public PricingConfigController(PricingConfigService pricingConfigService) {
        this.pricingConfigService = pricingConfigService;
    }

    @GetMapping
    public ResponseEntity<PricingConfigDto> getCurrentConfig() {
        return ResponseEntity.ok(pricingConfigService.getCurrentConfig());
    }

    @PutMapping
    public ResponseEntity<PricingConfigDto> updateConfig(
            @RequestBody PricingConfigDto dto,
            @AuthenticationPrincipal Jwt jwt) {
        log.info("Mise a jour de la configuration tarifaire par l'utilisateur {}", jwt.getSubject());
        return ResponseEntity.ok(pricingConfigService.updateConfig(dto));
    }

    // ─── Tarifs travaux (maintenance) — endpoint dédié ouvert aux techniciens ──
    // Périmètre restreint (travauxConfig uniquement) : les techniciens n'accèdent
    // PAS au reste de la tarification (forfaits, prix PMS, commissions…).

    @GetMapping("/travaux")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'TECHNICIAN')")
    public ResponseEntity<List<PricingConfigDto.ServicePriceConfig>> getTravaux() {
        return ResponseEntity.ok(pricingConfigService.getTravaux());
    }

    @PutMapping("/travaux")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'TECHNICIAN')")
    public ResponseEntity<List<PricingConfigDto.ServicePriceConfig>> updateTravaux(
            @RequestBody List<PricingConfigDto.ServicePriceConfig> travaux,
            @AuthenticationPrincipal Jwt jwt) {
        log.info("Mise a jour des tarifs travaux par l'utilisateur {}", jwt.getSubject());
        return ResponseEntity.ok(pricingConfigService.updateTravaux(travaux));
    }
}
