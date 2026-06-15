package com.clenzy.booking.controller;

import com.clenzy.booking.dto.BlogPostPublicDto;
import com.clenzy.booking.dto.BlogPostSummaryDto;
import com.clenzy.booking.dto.SitemapEntryDto;
import com.clenzy.booking.dto.SitePagePublicDto;
import com.clenzy.booking.dto.SitePublicDto;
import com.clenzy.booking.service.SiteDeliveryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    /** Index des articles publiés d'un site (blog / RSS). */
    @GetMapping("/{siteId}/posts")
    public ResponseEntity<List<BlogPostSummaryDto>> listPosts(@PathVariable Long siteId) {
        return ResponseEntity.ok(service.listPosts(siteId));
    }

    /** Contenu d'un article publié. */
    @GetMapping("/{siteId}/posts/by-slug")
    public ResponseEntity<BlogPostPublicDto> getPost(@PathVariable Long siteId,
                                                     @RequestParam String slug,
                                                     @RequestParam(required = false) String locale) {
        return service.getPost(siteId, slug, locale)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Sitemap agrégé (pages + articles) pour la génération du sitemap.xml côté SSR. */
    @GetMapping("/{siteId}/sitemap")
    public ResponseEntity<List<SitemapEntryDto>> sitemap(@PathVariable Long siteId) {
        return ResponseEntity.ok(service.sitemap(siteId));
    }
}
