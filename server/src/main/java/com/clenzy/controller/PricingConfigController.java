package com.clenzy.controller;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.model.Property;
import com.clenzy.service.PricingConfigService;
import com.clenzy.service.PropertyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pricing-config")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
public class PricingConfigController {

    private static final Logger log = LoggerFactory.getLogger(PricingConfigController.class);

    private final PricingConfigService pricingConfigService;
    private final PropertyService propertyService;

    public PricingConfigController(PricingConfigService pricingConfigService, PropertyService propertyService) {
        this.pricingConfigService = pricingConfigService;
        this.propertyService = propertyService;
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

    // ─── Estimation coût ménage d'une propriété (montant proposé dans la modale résa) ──
    // Ouvert à tout utilisateur authentifié (les hôtes créent des réservations) ; la
    // propriété est chargée org-scopée (garde fail-closed) → 404 hors de l'org.

    @GetMapping("/cleaning-estimate/{propertyId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> cleaningEstimate(@PathVariable Long propertyId) {
        Property property = propertyService.getSecuredPropertyEntity(propertyId);
        return ResponseEntity.ok(Map.of("estimate", pricingConfigService.estimateCleaningCost(property)));
    }

    // ─── Estimation ménage EN LOT (évite N appels sur une liste de logements) ──
    // Corps : { "propertyIds": [1,2,3] }. Chaque id est chargé org-scopé ; les
    // ids inaccessibles/inexistants sont OMIS (pas d'erreur globale). Borné à 200.

    @PostMapping("/cleaning-estimates")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> cleaningEstimates(@RequestBody Map<String, List<Long>> body) {
        List<Long> ids = body.getOrDefault("propertyIds", List.of());
        Map<Long, BigDecimal> estimates = new HashMap<>();
        for (Long id : ids.stream().filter(java.util.Objects::nonNull).distinct().limit(200).toList()) {
            try {
                Property property = propertyService.getSecuredPropertyEntity(id);
                estimates.put(id, pricingConfigService.estimateCleaningCost(property));
            } catch (RuntimeException e) {
                // Accès refusé / propriété inexistante → on omet cet id.
            }
        }
        return ResponseEntity.ok(Map.of("estimates", estimates));
    }
}
