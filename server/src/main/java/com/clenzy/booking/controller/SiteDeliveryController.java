package com.clenzy.booking.controller;

import com.clenzy.booking.dto.SitePagePublicDto;
import com.clenzy.booking.dto.SitePublicDto;
import com.clenzy.booking.service.SiteDeliveryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Livraison publique des sites hébergés (P1.1) — contrat REST consommé par le service SSR
 * « Clenzy Sites » (Next.js). Public : couvert par {@code /api/public/**} (permitAll dans
 * SecurityConfigProd). Ne sert que des sites/pages PUBLISHED.
 */
@RestController
@RequestMapping("/api/public/sites")
@PreAuthorize("permitAll()")
public class SiteDeliveryController {

    private final SiteDeliveryService service;

    public SiteDeliveryController(SiteDeliveryService service) {
        this.service = service;
    }

    /** Résout un hostname (sous-domaine ou domaine custom) → site + table des pages + SEO. */
    @GetMapping("/resolve")
    public ResponseEntity<SitePublicDto> resolve(@RequestParam String hostname) {
        return service.resolve(hostname)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Contenu d'une page (blocs + SEO) pour un site donné. */
    @GetMapping("/{siteId}/page")
    public ResponseEntity<SitePagePublicDto> getPage(@PathVariable Long siteId,
                                                     @RequestParam String path,
                                                     @RequestParam(required = false) String locale) {
        return service.getPage(siteId, path, locale)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
