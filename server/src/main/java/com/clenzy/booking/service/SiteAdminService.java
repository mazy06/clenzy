package com.clenzy.booking.service;

import com.clenzy.booking.dto.BlogPostDto;
import com.clenzy.booking.dto.SiteDomainDto;
import com.clenzy.booking.dto.SiteDomainRequest;
import com.clenzy.booking.dto.SiteDto;
import com.clenzy.booking.dto.SitePageDto;
import com.clenzy.booking.dto.SiteUpsertRequest;
import com.clenzy.booking.model.BlogPost;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SiteDomain;
import com.clenzy.booking.model.SiteDomainStatus;
import com.clenzy.booking.model.SitePage;
import com.clenzy.booking.model.SitePageType;
import com.clenzy.booking.model.SiteStatus;
import com.clenzy.booking.repository.BlogPostRepository;
import com.clenzy.booking.repository.SiteDomainRepository;
import com.clenzy.booking.repository.SitePageRepository;
import com.clenzy.booking.repository.SiteRepository;
import com.clenzy.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/**
 * Gestion des sites hébergés (P1.1) — CRUD sites / pages / domaines, scopé org (audit #3 : toute
 * ressource est chargée via une requête {@code ...AndOrganizationId} ou rattachée à un site possédé).
 * Service mince côté controller (audit #4) : la logique métier vit ici.
 */
@Service
public class SiteAdminService {

    private final SiteRepository siteRepository;
    private final SitePageRepository pageRepository;
    private final SiteDomainRepository domainRepository;
    private final BlogPostRepository blogPostRepository;

    public SiteAdminService(SiteRepository siteRepository,
                            SitePageRepository pageRepository,
                            SiteDomainRepository domainRepository,
                            BlogPostRepository blogPostRepository) {
        this.siteRepository = siteRepository;
        this.pageRepository = pageRepository;
        this.domainRepository = domainRepository;
        this.blogPostRepository = blogPostRepository;
    }

    // ─── Sites ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SiteDto> listSites(Long orgId) {
        return siteRepository.findByOrganizationId(orgId).stream().map(SiteDto::from).toList();
    }

    @Transactional(readOnly = true)
    public SiteDto getSite(Long orgId, Long id) {
        return SiteDto.from(requireOwnedSite(orgId, id));
    }

    @Transactional
    public SiteDto createSite(Long orgId, SiteUpsertRequest req) {
        if (siteRepository.existsBySlug(req.slug())) {
            throw new IllegalArgumentException("slug déjà utilisé: " + req.slug());
        }
        Site site = new Site();
        site.setOrganizationId(orgId);
        site.setSlug(req.slug());
        apply(site, req);
        return SiteDto.from(siteRepository.save(site));
    }

    @Transactional
    public SiteDto updateSite(Long orgId, Long id, SiteUpsertRequest req) {
        Site site = requireOwnedSite(orgId, id);
        if (!site.getSlug().equals(req.slug()) && siteRepository.existsBySlug(req.slug())) {
            throw new IllegalArgumentException("slug déjà utilisé: " + req.slug());
        }
        site.setSlug(req.slug());
        apply(site, req);
        return SiteDto.from(siteRepository.save(site));
    }

    @Transactional
    public void deleteSite(Long orgId, Long id) {
        Site site = requireOwnedSite(orgId, id);
        siteRepository.delete(site); // FK ON DELETE CASCADE → pages + domaines supprimés
    }

    // ─── Pages ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SitePageDto> listPages(Long orgId, Long siteId) {
        requireOwnedSite(orgId, siteId);
        return pageRepository.findBySiteIdOrderBySortOrderAsc(siteId).stream().map(SitePageDto::from).toList();
    }

    @Transactional
    public SitePageDto createPage(Long orgId, Long siteId, SitePageDto req) {
        requireOwnedSite(orgId, siteId);
        SitePage page = new SitePage();
        page.setSiteId(siteId);
        applyPage(page, req);
        return SitePageDto.from(pageRepository.save(page));
    }

    @Transactional
    public SitePageDto updatePage(Long orgId, Long siteId, Long pageId, SitePageDto req) {
        requireOwnedSite(orgId, siteId);
        SitePage page = pageRepository.findByIdAndSiteId(pageId, siteId)
            .orElseThrow(() -> new NotFoundException("Page introuvable: " + pageId));
        applyPage(page, req);
        return SitePageDto.from(pageRepository.save(page));
    }

    @Transactional
    public void deletePage(Long orgId, Long siteId, Long pageId) {
        requireOwnedSite(orgId, siteId);
        SitePage page = pageRepository.findByIdAndSiteId(pageId, siteId)
            .orElseThrow(() -> new NotFoundException("Page introuvable: " + pageId));
        pageRepository.delete(page);
    }

    // ─── Domaines ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SiteDomainDto> listDomains(Long orgId, Long siteId) {
        requireOwnedSite(orgId, siteId);
        return domainRepository.findBySiteId(siteId).stream().map(SiteDomainDto::from).toList();
    }

    @Transactional
    public SiteDomainDto addDomain(Long orgId, Long siteId, SiteDomainRequest req) {
        requireOwnedSite(orgId, siteId);
        String hostname = req.hostname().trim().toLowerCase(Locale.ROOT);
        if (domainRepository.existsByHostname(hostname)) {
            throw new IllegalArgumentException("Domaine déjà enregistré: " + hostname);
        }
        SiteDomain domain = new SiteDomain();
        domain.setSiteId(siteId);
        domain.setOrganizationId(orgId);
        domain.setHostname(hostname);
        domain.setPrimary(req.primary());
        domain.setStatus(SiteDomainStatus.PENDING);
        return SiteDomainDto.from(domainRepository.save(domain));
    }

    @Transactional
    public void removeDomain(Long orgId, Long domainId) {
        SiteDomain domain = domainRepository.findByIdAndOrganizationId(domainId, orgId)
            .orElseThrow(() -> new NotFoundException("Domaine introuvable: " + domainId));
        domainRepository.delete(domain);
    }

    // ─── Articles de blog (P1.3) ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<BlogPostDto> listPosts(Long orgId, Long siteId) {
        requireOwnedSite(orgId, siteId);
        return blogPostRepository.findBySiteIdOrderByPublishedAtDesc(siteId).stream().map(BlogPostDto::from).toList();
    }

    @Transactional
    public BlogPostDto createPost(Long orgId, Long siteId, BlogPostDto req) {
        requireOwnedSite(orgId, siteId);
        BlogPost post = new BlogPost();
        post.setSiteId(siteId);
        post.setOrganizationId(orgId);
        applyPost(post, req);
        return BlogPostDto.from(blogPostRepository.save(post));
    }

    @Transactional
    public BlogPostDto updatePost(Long orgId, Long siteId, Long postId, BlogPostDto req) {
        requireOwnedSite(orgId, siteId);
        BlogPost post = blogPostRepository.findByIdAndSiteId(postId, siteId)
            .orElseThrow(() -> new NotFoundException("Article introuvable: " + postId));
        applyPost(post, req);
        return BlogPostDto.from(blogPostRepository.save(post));
    }

    @Transactional
    public void deletePost(Long orgId, Long siteId, Long postId) {
        requireOwnedSite(orgId, siteId);
        BlogPost post = blogPostRepository.findByIdAndSiteId(postId, siteId)
            .orElseThrow(() -> new NotFoundException("Article introuvable: " + postId));
        blogPostRepository.delete(post);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private Site requireOwnedSite(Long orgId, Long siteId) {
        return siteRepository.findByIdAndOrganizationId(siteId, orgId)
            .orElseThrow(() -> new NotFoundException("Site introuvable: " + siteId));
    }

    private void apply(Site site, SiteUpsertRequest req) {
        if (req.name() != null) site.setName(req.name());
        if (req.status() != null) site.setStatus(parseStatus(req.status()));
        if (req.defaultLocale() != null) site.setDefaultLocale(req.defaultLocale());
        if (req.locales() != null) site.setLocales(req.locales());
        site.setDesignTokens(req.designTokens());
        site.setPrimaryColor(req.primaryColor());
        site.setFontFamily(req.fontFamily());
        site.setLogoUrl(req.logoUrl());
        site.setSeoTitle(req.seoTitle());
        site.setSeoDescription(req.seoDescription());
        site.setSeoOgImageUrl(req.seoOgImageUrl());
        site.setBookingEngineConfigId(req.bookingEngineConfigId());
    }

    private void applyPage(SitePage page, SitePageDto req) {
        if (req.path() != null) page.setPath(req.path());
        if (req.type() != null) page.setType(parsePageType(req.type()));
        page.setTitle(req.title());
        page.setBlocks(req.blocks());
        page.setLocale(req.locale());
        if (req.status() != null) page.setStatus(parseStatus(req.status()));
        page.setSortOrder(req.sortOrder());
        page.setSeoTitle(req.seoTitle());
        page.setSeoDescription(req.seoDescription());
        page.setSeoOgImageUrl(req.seoOgImageUrl());
    }

    private void applyPost(BlogPost post, BlogPostDto req) {
        if (req.slug() != null) post.setSlug(req.slug());
        post.setLocale(req.locale());
        if (req.title() != null) post.setTitle(req.title());
        post.setExcerpt(req.excerpt());
        post.setBody(req.body());
        post.setCoverImageUrl(req.coverImageUrl());
        post.setTags(req.tags());
        if (req.status() != null) post.setStatus(parseStatus(req.status()));
        post.setSeoTitle(req.seoTitle());
        post.setSeoDescription(req.seoDescription());
        post.setSeoOgImageUrl(req.seoOgImageUrl());
        if (req.publishedAt() != null) {
            post.setPublishedAt(req.publishedAt());
        }
        // Première publication : horodate automatiquement si non fourni.
        if (post.getStatus() == SiteStatus.PUBLISHED && post.getPublishedAt() == null) {
            post.setPublishedAt(LocalDateTime.now());
        }
    }

    private SiteStatus parseStatus(String value) {
        try {
            return SiteStatus.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Statut invalide: " + value);
        }
    }

    private SitePageType parsePageType(String value) {
        try {
            return SitePageType.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Type de page invalide: " + value);
        }
    }
}
