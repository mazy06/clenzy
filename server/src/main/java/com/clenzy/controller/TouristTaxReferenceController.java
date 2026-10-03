package com.clenzy.controller;

import com.clenzy.dto.TouristTaxSuggestionDto;
import com.clenzy.service.regulatory.TouristTaxReferenceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Suggestion de bareme de taxe de sejour pour un logement EN COURS DE CREATION (pas encore
 * d'identifiant) : ouverte a ceux qui creent des logements, pas seulement aux gestionnaires
 * du reglage fiscal. Donnees publiques de reference : aucune donnee d'organisation exposee.
 */
@RestController
@RequestMapping("/api/tourist-tax-reference")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class TouristTaxReferenceController {

    private final TouristTaxReferenceService referenceService;

    public TouristTaxReferenceController(TouristTaxReferenceService referenceService) {
        this.referenceService = referenceService;
    }

    /** 404 si aucun tarif n'est connu (commune sans taxe, catégorie absente, adresse introuvable). */
    @GetMapping("/suggest")
    public ResponseEntity<TouristTaxSuggestionDto> suggest(@RequestParam String countryCode,
                                                           @RequestParam(required = false) String address,
                                                           @RequestParam(required = false) String postalCode,
                                                           @RequestParam String city,
                                                           @RequestParam String category) {
        return referenceService.suggest(countryCode, address, postalCode, city, category)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
