package com.clenzy.controller;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.model.Property;
import com.clenzy.service.PricingConfigService;
import com.clenzy.service.PropertyService;
import com.clenzy.service.pricing.CleaningPricingEngine;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningInputs;
import com.clenzy.service.pricing.CleaningPricingEngine.CleaningQuote;
import com.clenzy.service.pricing.CleaningPricingEngine.ResolvedCleaningPrice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pricing-config")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
public class PricingConfigController {

    private static final Logger log = LoggerFactory.getLogger(PricingConfigController.class);

    /** Types de ménage exposés par le preview (multiplicateurs du moteur). */
    private static final List<String> PREVIEW_CLEANING_TYPES =
            List.of("EXPRESS_CLEANING", "CLEANING", "DEEP_CLEANING");

    private final PricingConfigService pricingConfigService;
    private final PropertyService propertyService;
    private final CleaningPricingEngine cleaningPricingEngine;

    public PricingConfigController(PricingConfigService pricingConfigService,
                                   PropertyService propertyService,
                                   CleaningPricingEngine cleaningPricingEngine) {
        this.pricingConfigService = pricingConfigService;
        this.propertyService = propertyService;
        this.cleaningPricingEngine = cleaningPricingEngine;
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

    // ─── Estimation coût ménage d'une propriété (Moteur Ménage, prix RÉSOLU) ──
    // Ouvert à tout utilisateur authentifié (les hôtes créent des réservations) ; la
    // propriété est chargée org-scopée (garde fail-closed) → 404 hors de l'org.
    // `estimate` = prix résolu (override logement OU conseil moteur) — clé conservée
    // pour compat front ; source/min/max/durationMinutes enrichissent l'affichage.

    @GetMapping("/cleaning-estimate/{propertyId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> cleaningEstimate(@PathVariable Long propertyId) {
        Property property = propertyService.getSecuredPropertyEntity(propertyId);
        ResolvedCleaningPrice resolved =
                cleaningPricingEngine.resolveCleaningPrice(property, CleaningPricingEngine.STANDARD_CLEANING);
        Map<String, Object> bodyOut = new LinkedHashMap<>();
        bodyOut.put("estimate", resolved.amount());
        bodyOut.put("source", resolved.source().name());
        bodyOut.put("min", resolved.quote().min());
        bodyOut.put("max", resolved.quote().max());
        bodyOut.put("durationMinutes", resolved.quote().durationMinutes());
        return ResponseEntity.ok(bodyOut);
    }

    // ─── Estimation ménage EN LOT (évite N appels sur une liste de logements) ──
    // Corps : { "propertyIds": [1,2,3] }. Chaque id est chargé org-scopé ; les
    // ids inaccessibles/inexistants sont OMIS (pas d'erreur globale). Borné à 200.
    // Valeurs = prix RÉSOLUS (shape {estimates:{id:montant}} conservé pour le front).

    @PostMapping("/cleaning-estimates")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> cleaningEstimates(@RequestBody Map<String, List<Long>> body) {
        List<Long> ids = body.getOrDefault("propertyIds", List.of());
        Map<Long, BigDecimal> estimates = new HashMap<>();
        for (Long id : ids.stream().filter(java.util.Objects::nonNull).distinct().limit(200).toList()) {
            try {
                Property property = propertyService.getSecuredPropertyEntity(id);
                estimates.put(id, cleaningPricingEngine
                        .resolveCleaningPrice(property, CleaningPricingEngine.STANDARD_CLEANING).amount());
            } catch (RuntimeException e) {
                // Accès refusé / propriété inexistante → on omet cet id.
            }
        }
        return ResponseEntity.ok(Map.of("estimates", estimates));
    }

    // ─── Preview du moteur (valeurs brouillon, sans propriété persistée) ──────
    // Body = composants du logement (+ multiplicateurs par type). Renvoie les quotes
    // par type + la décomposition transparente des minutes par composant.

    /** Body du preview : composants du logement (tous optionnels). */
    public record CleaningPreviewRequest(
            Integer bedrooms, Integer bathrooms, Integer squareMeters, Integer floors,
            Boolean hasExterior, Boolean hasLaundry, Integer maxGuests,
            List<String> cleaningTypes,
            /** Date de prestation optionnelle (ISO) — applique la majoration saisonnière (MM-3D). */
            String serviceDate) {
    }

    @PostMapping("/cleaning-estimate/preview")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> cleaningEstimatePreview(@RequestBody CleaningPreviewRequest request) {
        CleaningInputs inputs = new CleaningInputs(
                request.bedrooms(), request.bathrooms(), request.squareMeters(), request.floors(),
                request.hasExterior(), request.hasLaundry(), request.maxGuests());

        List<String> types = request.cleaningTypes() != null && !request.cleaningTypes().isEmpty()
                ? request.cleaningTypes()
                : PREVIEW_CLEANING_TYPES;

        java.time.LocalDate serviceDate = null;
        if (request.serviceDate() != null && !request.serviceDate().isBlank()) {
            try {
                serviceDate = java.time.LocalDate.parse(request.serviceDate());
            } catch (java.time.format.DateTimeParseException e) {
                // Date invalide → preview sans majoration (jamais d'erreur bloquante).
            }
        }

        Map<String, Object> quotes = new LinkedHashMap<>();
        for (String type : types) {
            CleaningQuote quote = cleaningPricingEngine.quote(inputs, type, serviceDate);
            quotes.put(type, Map.of(
                    "durationMinutes", quote.durationMinutes(),
                    "recommended", quote.recommended(),
                    "min", quote.min(),
                    "max", quote.max()));
        }

        Map<String, Object> bodyOut = new LinkedHashMap<>();
        bodyOut.put("quotes", quotes);
        bodyOut.put("minutesBreakdown", cleaningPricingEngine.minutesBreakdown(inputs));
        return ResponseEntity.ok(bodyOut);
    }
}
