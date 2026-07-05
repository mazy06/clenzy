package com.clenzy.controller;

import com.clenzy.dto.PricingConfigDto.ServicePriceConfig;
import com.clenzy.service.TechnicianPrestationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Prestations « travaux » PROPRES au technicien connecté (surcouche). Chaque
 * utilisateur authentifié ne lit/écrit QUE ses propres lignes (org + user
 * résolus côté serveur, jamais depuis le client). Controller mince : délégation.
 */
@RestController
@RequestMapping("/api/technician-prestations")
@PreAuthorize("isAuthenticated()")
public class TechnicianPrestationController {

    private static final Logger log = LoggerFactory.getLogger(TechnicianPrestationController.class);

    private final TechnicianPrestationService service;

    public TechnicianPrestationController(TechnicianPrestationService service) {
        this.service = service;
    }

    @GetMapping
    public List<ServicePriceConfig> getMine(@AuthenticationPrincipal Jwt jwt) {
        return service.getMine(jwt.getSubject());
    }

    /** Catalogue org (services actifs) pour pré-lister l'écran du technicien. */
    @GetMapping("/catalogue")
    public List<ServicePriceConfig> catalogue() {
        return service.getCatalogue();
    }

    @PutMapping
    public List<ServicePriceConfig> updateMine(
            @RequestBody List<ServicePriceConfig> items,
            @AuthenticationPrincipal Jwt jwt) {
        log.info("Mise a jour des prestations travaux du technicien {}", jwt.getSubject());
        return service.updateMine(jwt.getSubject(), items);
    }

    // ─── P2 : matching — techniciens qui proposent les types de prestation ─────
    // Org-scopé (retourne des ids d'utilisateurs de l'org). Sert à mettre en avant
    // les techniciens qualifiés à l'assignation (pas de peintre pour l'électricité).
    @GetMapping("/offering")
    public List<Long> offering(@RequestParam(name = "types") List<String> types) {
        return service.findUsersOffering(types);
    }

    // ─── P3 : tarifs d'un technicien donné — pour appliquer ses prix au devis ──
    // Réservé aux profils qui assignent (l'auto-service « ses propres » reste GET /).
    @GetMapping("/for-user/{userId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR')")
    public List<ServicePriceConfig> forUser(@PathVariable Long userId) {
        return service.getForUser(userId);
    }
}
