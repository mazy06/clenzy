package com.clenzy.booking.service;

import com.clenzy.booking.dto.BlogPostDto;
import com.clenzy.booking.dto.SiteDomainDto;
import com.clenzy.booking.dto.SiteDomainRequest;
import com.clenzy.booking.dto.SiteDto;
import com.clenzy.booking.dto.SitePageDto;
import com.clenzy.booking.dto.SiteUpsertRequest;
import com.clenzy.booking.model.BlogPost;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SiteDomain;
import com.clenzy.booking.model.SiteDomainStatus;
import com.clenzy.booking.model.SitePage;
import com.clenzy.booking.model.SitePageType;
import com.clenzy.booking.model.SiteStatus;
import com.clenzy.booking.repository.BlogPostRepository;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.repository.SiteDomainRepository;
import com.clenzy.booking.repository.SitePageRepository;
import com.clenzy.booking.repository.SiteRepository;
import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.cloudflare.CloudflareCustomHostnameService;
import com.clenzy.model.NotificationCategory;
import com.clenzy.model.NotificationType;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.NotificationService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.text.Normalizer;
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
    private final BookingEngineConfigRepository bookingEngineConfigRepository;
    private final CloudflareCustomHostnameService cloudflareService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final ObjectProvider<SiteAdminService> self;

    public SiteAdminService(SiteRepository siteRepository,
                            SitePageRepository pageRepository,
                            SiteDomainRepository domainRepository,
                            BlogPostRepository blogPostRepository,
                            BookingEngineConfigRepository bookingEngineConfigRepository,
                            CloudflareCustomHostnameService cloudflareService,
                            NotificationService notificationService,
                            UserRepository userRepository,
                            ObjectProvider<SiteAdminService> self) {
        this.siteRepository = siteRepository;
        this.pageRepository = pageRepository;
        this.domainRepository = domainRepository;
        this.blogPostRepository = blogPostRepository;
        this.bookingEngineConfigRepository = bookingEngineConfigRepository;
        this.cloudflareService = cloudflareService;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.self = self;
    }

    // ─── Bootstrap multi-page (Studio) ────────────────────────────────────────

    /**
     * Find-or-create du {@link Site} rattaché à une config de widget, pour activer le multi-page
     * dans le Studio sans casser le flux mono-page existant. Au premier appel : crée le site (slug
     * unique dérivé du nom, thème copié de la config) puis migre le {@code pageLayout} mono-page en
     * page d'accueil ({@link SitePageType#HOME}). Idempotent. Audit #3 : ownership vérifié sur la config.
     */
    @Transactional
    public SiteDto ensureSiteForConfig(Long orgId, Long configId) {
        BookingEngineConfig config = bookingEngineConfigRepository.findById(configId)
            .orElseThrow(() -> new NotFoundException("Config introuvable: " + configId));
        if (!orgId.equals(config.getOrganizationId())) {
            throw new AccessDeniedException("Config hors de l'organisation");
        }
        Site site = siteRepository.findFirstByBookingEngineConfigIdAndOrganizationId(configId, orgId)
            .orElseGet(() -> createSiteForConfig(orgId, config));
        ensureHomePage(site, config);
        return SiteDto.from(site);
    }

    private Site createSiteForConfig(Long orgId, BookingEngineConfig config) {
        Site site = new Site();
        site.setOrganizationId(orgId);
        site.setBookingEngineConfigId(config.getId());
        site.setSlug(uniqueSlug(config.getName()));
        if (config.getName() != null && !config.getName().isBlank()) {
            site.setName(config.getName());
        }
        site.setStatus(SiteStatus.DRAFT);
        site.setDesignTokens(config.getDesignTokens());
        site.setPrimaryColor(config.getPrimaryColor());
        site.setFontFamily(config.getFontFamily());
        return siteRepository.save(site);
    }

    /** Crée la page d'accueil à partir du {@code pageLayout} mono-page si le site n'a aucune page. */
    private void ensureHomePage(Site site, BookingEngineConfig config) {
        if (!pageRepository.findBySiteIdOrderBySortOrderAsc(site.getId()).isEmpty()) {
            return;
        }
        SitePage home = new SitePage();
        home.setSiteId(site.getId());
        home.setPath("/");
        home.setType(SitePageType.HOME);
        home.setTitle("Accueil");
        home.setBlocks(config.getPageLayout());
        home.setStatus(SiteStatus.PUBLISHED);
        home.setSortOrder(0);
        pageRepository.save(home);
    }

    private String uniqueSlug(String base) {
        String slug = slugify(base);
        if (slug.isEmpty()) {
            slug = "site";
        }
        String candidate = slug;
        int n = 2;
        while (siteRepository.existsBySlug(candidate)) {
            candidate = slug + "-" + n++;
        }
        return candidate;
    }

    private String slugify(String input) {
        if (input == null) {
            return "";
        }
        String s = Normalizer.normalize(input, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        s = s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return s.length() > 50 ? s.substring(0, 50).replaceAll("-$", "") : s;
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

    /**
     * Crée une page générée par IA (P2.a) : forcée en {@code DRAFT} + {@code aiGenerated=true} pour
     * relecture humaine (jamais auto-publiée — même garde-fou que l'auto-traduction et le blog IA, 2.13).
     * Le statut demandé dans le DTO est ignoré : seul DRAFT est autorisé pour du contenu IA.
     */
    @Transactional
    public SitePageDto createAiGeneratedPage(Long orgId, Long siteId, SitePageDto req) {
        requireOwnedSite(orgId, siteId);
        // Upsert par (path, langue) : la génération est autoritaire pour ces chemins. On supprime la page
        // existante de même path (même langue OU langue nulle — ex. la page « Accueil » par défaut seedée à
        // la création du site par ensureHomePage) pour éviter un doublon avec la page générée.
        deleteCollidingPage(siteId, req.path(), req.locale());
        SitePage page = new SitePage();
        page.setSiteId(siteId);
        applyPage(page, req);
        page.setStatus(SiteStatus.DRAFT);
        page.setAiGenerated(true);
        return SitePageDto.from(pageRepository.save(page));
    }

    /** Supprime la page existante en collision de chemin (même langue + variante langue nulle legacy). */
    private void deleteCollidingPage(Long siteId, String path, String locale) {
        if (path == null) {
            return;
        }
        if (locale != null && !locale.isBlank()) {
            pageRepository.findBySiteIdAndPathAndLocale(siteId, path, locale).ifPresent(pageRepository::delete);
        }
        pageRepository.findBySiteIdAndPathAndLocaleIsNull(siteId, path).ifPresent(pageRepository::delete);
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

    /**
     * Publie une page (2.7) : fige le brouillon courant ({@code blocks}) dans l'instantané servi au
     * public ({@code publishedBlocks}) et marque la page PUBLISHED. Tant qu'on ne publie pas, la
     * version en ligne reste intacte.
     */
    @Transactional
    public SitePageDto publishPage(Long orgId, Long siteId, Long pageId) {
        requireOwnedSite(orgId, siteId);
        SitePage page = pageRepository.findByIdAndSiteId(pageId, siteId)
            .orElseThrow(() -> new NotFoundException("Page introuvable: " + pageId));
        page.setPublishedBlocks(page.getBlocks());
        page.setPublishedAt(LocalDateTime.now());
        page.setStatus(SiteStatus.PUBLISHED);
        return SitePageDto.from(pageRepository.save(page));
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
        SiteDomain saved = domainRepository.save(domain);

        // Bridge Cloudflare for SaaS (gated) : provisionne le custom hostname APRÈS commit (audit #2).
        if (cloudflareService.isEnabled()) {
            final Long domainId = saved.getId();
            runAfterCommit(() -> cloudflareService.createCustomHostname(hostname)
                .ifPresent(r -> self.getObject().markDomainProvisioned(orgId, domainId, r.hostnameId(), r.status())));
        }
        return SiteDomainDto.from(saved);
    }

    @Transactional
    public void removeDomain(Long orgId, Long domainId) {
        SiteDomain domain = domainRepository.findByIdAndOrganizationId(domainId, orgId)
            .orElseThrow(() -> new NotFoundException("Domaine introuvable: " + domainId));
        final String cloudflareHostnameId = domain.getCloudflareHostnameId();
        domainRepository.delete(domain);
        if (cloudflareHostnameId != null && cloudflareService.isEnabled()) {
            runAfterCommit(() -> cloudflareService.deleteCustomHostname(cloudflareHostnameId));
        }
    }

    /** Persiste l'id Cloudflare + le statut d'un domaine provisionné (afterCommit de {@link #addDomain}). */
    @Transactional
    public void markDomainProvisioned(Long orgId, Long domainId, String cloudflareHostnameId, SiteDomainStatus status) {
        domainRepository.findByIdAndOrganizationId(domainId, orgId).ifPresent(d -> {
            d.setCloudflareHostnameId(cloudflareHostnameId);
            d.setStatus(status);
            if (status == SiteDomainStatus.ACTIVE) {
                d.setVerified(true);
            }
            domainRepository.save(d);
        });
    }

    /** Réconcilie les domaines PENDING provisionnés avec leur statut Cloudflare (scheduler, hors-tx). */
    public void reconcileCustomDomains() {
        if (!cloudflareService.isEnabled()) {
            return;
        }
        for (SiteDomain d : domainRepository.findByStatusAndCloudflareHostnameIdIsNotNull(SiteDomainStatus.PENDING)) {
            cloudflareService.getStatus(d.getCloudflareHostnameId())
                .filter(st -> st != SiteDomainStatus.PENDING)
                .ifPresent(st -> self.getObject().applyDomainStatus(d.getId(), st));
        }
    }

    @Transactional
    public void applyDomainStatus(Long domainId, SiteDomainStatus status) {
        domainRepository.findById(domainId).ifPresent(d -> {
            d.setStatus(status);
            if (status == SiteDomainStatus.ACTIVE) {
                d.setVerified(true);
            }
            domainRepository.save(d);
        });
    }

    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
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
        BlogPost saved = blogPostRepository.save(post);
        if (saved.getStatus() == SiteStatus.PENDING_REVIEW) {
            notifyReviewers(orgId, saved);
        }
        return BlogPostDto.from(saved);
    }

    @Transactional
    public BlogPostDto updatePost(Long orgId, Long siteId, Long postId, BlogPostDto req) {
        requireOwnedSite(orgId, siteId);
        BlogPost post = blogPostRepository.findByIdAndSiteId(postId, siteId)
            .orElseThrow(() -> new NotFoundException("Article introuvable: " + postId));
        SiteStatus before = post.getStatus();
        applyPost(post, req);
        BlogPost saved = blogPostRepository.save(post);
        // Alerte une seule fois, à l'ENTRÉE en relecture (pas à chaque sauvegarde du brouillon en review).
        if (saved.getStatus() == SiteStatus.PENDING_REVIEW && before != SiteStatus.PENDING_REVIEW) {
            notifyReviewers(orgId, saved);
        }
        return BlogPostDto.from(saved);
    }

    @Transactional
    public void deletePost(Long orgId, Long siteId, Long postId) {
        requireOwnedSite(orgId, siteId);
        BlogPost post = blogPostRepository.findByIdAndSiteId(postId, siteId)
            .orElseThrow(() -> new NotFoundException("Article introuvable: " + postId));
        blogPostRepository.delete(post);
    }

    /**
     * Valide et publie un article (2.13) : seul chemin vers PUBLISHED → garantit une relecture
     * manuelle avant la mise en prod. Trace le relecteur (keycloakId) et l'horodatage.
     */
    @Transactional
    public BlogPostDto approvePost(Long orgId, Long siteId, Long postId, String reviewerKeycloakId) {
        requireOwnedSite(orgId, siteId);
        BlogPost post = blogPostRepository.findByIdAndSiteId(postId, siteId)
            .orElseThrow(() -> new NotFoundException("Article introuvable: " + postId));
        post.setStatus(SiteStatus.PUBLISHED);
        if (post.getPublishedAt() == null) {
            post.setPublishedAt(LocalDateTime.now());
        }
        post.setReviewedAt(LocalDateTime.now());
        post.setReviewedBy(reviewerKeycloakId);
        return BlogPostDto.from(blogPostRepository.save(post));
    }

    /** Renvoie un article en brouillon (relecteur : corrections demandées avant nouvelle soumission). */
    @Transactional
    public BlogPostDto rejectPost(Long orgId, Long siteId, Long postId) {
        requireOwnedSite(orgId, siteId);
        BlogPost post = blogPostRepository.findByIdAndSiteId(postId, siteId)
            .orElseThrow(() -> new NotFoundException("Article introuvable: " + postId));
        post.setStatus(SiteStatus.DRAFT);
        return BlogPostDto.from(blogPostRepository.save(post));
    }

    /** Alerte les relecteurs de l'org (hôtes + superviseurs) qu'un article attend validation (2.13). */
    private void notifyReviewers(Long orgId, BlogPost post) {
        String title = "Article en attente de validation";
        String aiTag = post.isAiGenerated() ? " (généré par IA)" : "";
        String message = "L'article « " + post.getTitle() + " »" + aiTag
            + " doit être relu et validé avant sa publication.";
        for (User reviewer : userRepository.findByRoleIn(List.of(UserRole.HOST, UserRole.SUPERVISOR), orgId)) {
            if (reviewer.getKeycloakId() != null) {
                notificationService.create(reviewer.getKeycloakId(), title, message,
                    NotificationType.WARNING, NotificationCategory.REVIEW, "/booking-engine/studio");
            }
        }
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
        if (req.status() != null) {
            SiteStatus requested = parseStatus(req.status());
            // Validation manuelle OBLIGATOIRE avant prod (2.13) : le save normal ne publie jamais
            // directement — une demande PUBLISHED est ramenée à PENDING_REVIEW (passe par l'approbation).
            post.setStatus(requested == SiteStatus.PUBLISHED ? SiteStatus.PENDING_REVIEW : requested);
        }
        if (req.aiGenerated()) {
            post.setAiGenerated(true); // sticky : un article généré par IA reste flaggé
        }
        post.setSeoTitle(req.seoTitle());
        post.setSeoDescription(req.seoDescription());
        post.setSeoOgImageUrl(req.seoOgImageUrl());
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
