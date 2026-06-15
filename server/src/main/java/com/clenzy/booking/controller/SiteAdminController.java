package com.clenzy.booking.controller;

import com.clenzy.booking.dto.BlogPostDto;
import com.clenzy.booking.dto.SiteDomainDto;
import com.clenzy.booking.dto.SiteDomainRequest;
import com.clenzy.booking.dto.SiteDto;
import com.clenzy.booking.dto.SitePageDto;
import com.clenzy.booking.dto.SiteUpsertRequest;
import com.clenzy.booking.service.SiteAdminService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Gestion des sites hébergés « Clenzy Sites » (P1.1) — controller mince (audit #4) délégant à
 * {@link SiteAdminService}. Scopé org via {@link TenantContext}. Sécurisé par
 * {@code /api/**} (rôles métier dans SecurityConfigProd) + {@code @PreAuthorize}.
 */
@RestController
@RequestMapping("/api/sites")
@PreAuthorize("isAuthenticated()")
public class SiteAdminController {

    private final SiteAdminService service;
    private final TenantContext tenantContext;

    public SiteAdminController(SiteAdminService service, TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    private Long orgId() {
        return tenantContext.getRequiredOrganizationId();
    }

    // ─── Sites ──────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<SiteDto>> list() {
        return ResponseEntity.ok(service.listSites(orgId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SiteDto> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.getSite(orgId(), id));
    }

    @PostMapping
    public ResponseEntity<SiteDto> create(@Valid @RequestBody SiteUpsertRequest req) {
        return ResponseEntity.ok(service.createSite(orgId(), req));
    }

    /** Find-or-create du site rattaché à une config de widget (bootstrap multi-page du Studio). */
    @PostMapping("/ensure-for-config/{configId}")
    public ResponseEntity<SiteDto> ensureForConfig(@PathVariable Long configId) {
        return ResponseEntity.ok(service.ensureSiteForConfig(orgId(), configId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SiteDto> update(@PathVariable Long id, @Valid @RequestBody SiteUpsertRequest req) {
        return ResponseEntity.ok(service.updateSite(orgId(), id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteSite(orgId(), id);
        return ResponseEntity.noContent().build();
    }

    // ─── Pages ──────────────────────────────────────────────────────────────

    @GetMapping("/{id}/pages")
    public ResponseEntity<List<SitePageDto>> listPages(@PathVariable Long id) {
        return ResponseEntity.ok(service.listPages(orgId(), id));
    }

    @PostMapping("/{id}/pages")
    public ResponseEntity<SitePageDto> createPage(@PathVariable Long id, @RequestBody SitePageDto req) {
        return ResponseEntity.ok(service.createPage(orgId(), id, req));
    }

    @PutMapping("/{id}/pages/{pageId}")
    public ResponseEntity<SitePageDto> updatePage(@PathVariable Long id, @PathVariable Long pageId,
                                                  @RequestBody SitePageDto req) {
        return ResponseEntity.ok(service.updatePage(orgId(), id, pageId, req));
    }

    @DeleteMapping("/{id}/pages/{pageId}")
    public ResponseEntity<Void> deletePage(@PathVariable Long id, @PathVariable Long pageId) {
        service.deletePage(orgId(), id, pageId);
        return ResponseEntity.noContent().build();
    }

    // ─── Domaines ───────────────────────────────────────────────────────────

    @GetMapping("/{id}/domains")
    public ResponseEntity<List<SiteDomainDto>> listDomains(@PathVariable Long id) {
        return ResponseEntity.ok(service.listDomains(orgId(), id));
    }

    @PostMapping("/{id}/domains")
    public ResponseEntity<SiteDomainDto> addDomain(@PathVariable Long id, @Valid @RequestBody SiteDomainRequest req) {
        return ResponseEntity.ok(service.addDomain(orgId(), id, req));
    }

    @DeleteMapping("/{id}/domains/{domainId}")
    public ResponseEntity<Void> removeDomain(@PathVariable Long id, @PathVariable Long domainId) {
        service.removeDomain(orgId(), domainId);
        return ResponseEntity.noContent().build();
    }

    // ─── Articles de blog (P1.3) ─────────────────────────────────────────────

    @GetMapping("/{id}/posts")
    public ResponseEntity<List<BlogPostDto>> listPosts(@PathVariable Long id) {
        return ResponseEntity.ok(service.listPosts(orgId(), id));
    }

    @PostMapping("/{id}/posts")
    public ResponseEntity<BlogPostDto> createPost(@PathVariable Long id, @RequestBody BlogPostDto req) {
        return ResponseEntity.ok(service.createPost(orgId(), id, req));
    }

    @PutMapping("/{id}/posts/{postId}")
    public ResponseEntity<BlogPostDto> updatePost(@PathVariable Long id, @PathVariable Long postId,
                                                  @RequestBody BlogPostDto req) {
        return ResponseEntity.ok(service.updatePost(orgId(), id, postId, req));
    }

    @DeleteMapping("/{id}/posts/{postId}")
    public ResponseEntity<Void> deletePost(@PathVariable Long id, @PathVariable Long postId) {
        service.deletePost(orgId(), id, postId);
        return ResponseEntity.noContent().build();
    }
}
