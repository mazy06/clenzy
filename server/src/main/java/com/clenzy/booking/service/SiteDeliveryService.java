package com.clenzy.booking.service;

import com.clenzy.booking.dto.BlogPostPublicDto;
import com.clenzy.booking.dto.BlogPostSummaryDto;
import com.clenzy.booking.dto.SitemapEntryDto;
import com.clenzy.booking.dto.SitePagePublicDto;
import com.clenzy.booking.dto.SitePublicDto;
import com.clenzy.booking.model.BlogPost;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SiteDomainStatus;
import com.clenzy.booking.model.SitePage;
import com.clenzy.booking.model.SiteStatus;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BlogPostRepository;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.repository.SiteDomainRepository;
import com.clenzy.booking.repository.SitePageRepository;
import com.clenzy.booking.repository.SiteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Livraison publique des sites hébergés (P1.1) — contrat consommé par le service SSR « Clenzy Sites ».
 * Résout un hostname (sous-domaine {@code {slug}.clenzy.site} ou domaine custom ACTIVE) vers un site
 * PUBLISHED + sa table de pages, puis sert le contenu d'une page. Ne renvoie jamais de brouillon.
 */
@Service
public class SiteDeliveryService {

    private static final String BASE_SUFFIX = ".clenzy.site";

    private final SiteRepository siteRepository;
    private final SitePageRepository pageRepository;
    private final SiteDomainRepository domainRepository;
    private final BlogPostRepository blogPostRepository;
    private final BookingEngineConfigRepository bookingEngineConfigRepository;

    public SiteDeliveryService(SiteRepository siteRepository,
                               SitePageRepository pageRepository,
                               SiteDomainRepository domainRepository,
                               BlogPostRepository blogPostRepository,
                               BookingEngineConfigRepository bookingEngineConfigRepository) {
        this.siteRepository = siteRepository;
        this.pageRepository = pageRepository;
        this.domainRepository = domainRepository;
        this.blogPostRepository = blogPostRepository;
        this.bookingEngineConfigRepository = bookingEngineConfigRepository;
    }

    @Transactional(readOnly = true)
    public Optional<SitePublicDto> resolve(String hostname) {
        Site site = resolveSite(hostname);
        if (site == null || site.getStatus() != SiteStatus.PUBLISHED) {
            return Optional.empty();
        }
        List<SitePage> pages = pageRepository.findBySiteIdOrderBySortOrderAsc(site.getId()).stream()
            .filter(p -> p.getStatus() == SiteStatus.PUBLISHED)
            .toList();
        // Booking engine lié : clé publique (X-Booking-Key, montage du widget) + CSS/JS custom du
        // site (injectés dans le layout SSR pour la fidélité du design importé).
        BookingEngineConfig config = site.getBookingEngineConfigId() == null ? null
            : bookingEngineConfigRepository.findById(site.getBookingEngineConfigId()).orElse(null);
        String apiKey = config != null ? config.getApiKey() : null;
        String customCss = config != null ? config.getCustomCss() : null;
        String customJs = config != null ? config.getCustomJs() : null;
        // Composition de réservation (micro-widgets) → le SDK la rend au montage côté SSR.
        String componentConfig = config != null ? config.getComponentConfig() : null;
        return Optional.of(SitePublicDto.from(site, apiKey, customCss, customJs, componentConfig, pages));
    }

    @Transactional(readOnly = true)
    public Optional<SitePagePublicDto> getPage(Long siteId, String path, String locale) {
        Site site = siteRepository.findById(siteId).orElse(null);
        if (site == null || site.getStatus() != SiteStatus.PUBLISHED) {
            return Optional.empty();
        }
        SitePage page = null;
        if (locale != null && !locale.isBlank()) {
            page = pageRepository.findBySiteIdAndPathAndLocale(siteId, path, locale).orElse(null);
        }
        if (page == null) {
            page = pageRepository.findBySiteIdAndPathAndLocaleIsNull(siteId, path).orElse(null);
        }
        if (page == null || page.getStatus() != SiteStatus.PUBLISHED) {
            return Optional.empty();
        }
        return Optional.of(SitePagePublicDto.from(page));
    }

    /** Articles publiés d'un site (index blog / RSS). */
    @Transactional(readOnly = true)
    public List<BlogPostSummaryDto> listPosts(Long siteId) {
        Site site = siteRepository.findById(siteId).orElse(null);
        if (site == null || site.getStatus() != SiteStatus.PUBLISHED) {
            return List.of();
        }
        return blogPostRepository.findBySiteIdAndStatusOrderByPublishedAtDesc(siteId, SiteStatus.PUBLISHED)
            .stream().map(BlogPostSummaryDto::from).toList();
    }

    /** Contenu d'un article publié (corps complet), avec repli locale. */
    @Transactional(readOnly = true)
    public Optional<BlogPostPublicDto> getPost(Long siteId, String slug, String locale) {
        Site site = siteRepository.findById(siteId).orElse(null);
        if (site == null || site.getStatus() != SiteStatus.PUBLISHED) {
            return Optional.empty();
        }
        BlogPost post = null;
        if (locale != null && !locale.isBlank()) {
            post = blogPostRepository.findBySiteIdAndSlugAndLocale(siteId, slug, locale).orElse(null);
        }
        if (post == null) {
            post = blogPostRepository.findBySiteIdAndSlugAndLocaleIsNull(siteId, slug).orElse(null);
        }
        if (post == null || post.getStatus() != SiteStatus.PUBLISHED) {
            return Optional.empty();
        }
        return Optional.of(BlogPostPublicDto.from(post));
    }

    /**
     * Sitemap agrégé (P1.2) : pages + articles publiés d'un site. Le service SSR y ajoute les URLs
     * dynamiques (liste/détail propriétés depuis l'API publique) et compose le XML (loc + hreflang).
     */
    @Transactional(readOnly = true)
    public List<SitemapEntryDto> sitemap(Long siteId) {
        Site site = siteRepository.findById(siteId).orElse(null);
        if (site == null || site.getStatus() != SiteStatus.PUBLISHED) {
            return List.of();
        }
        List<SitemapEntryDto> entries = new ArrayList<>();
        pageRepository.findBySiteIdOrderBySortOrderAsc(siteId).stream()
            .filter(p -> p.getStatus() == SiteStatus.PUBLISHED)
            .forEach(p -> entries.add(new SitemapEntryDto(
                p.getPath(), p.getType() != null ? p.getType().name() : "CUSTOM", p.getLocale(), p.getUpdatedAt())));
        blogPostRepository.findBySiteIdAndStatusOrderByPublishedAtDesc(siteId, SiteStatus.PUBLISHED)
            .forEach(post -> entries.add(new SitemapEntryDto(
                "/blog/" + post.getSlug(), "BLOG_POST", post.getLocale(), post.getUpdatedAt())));
        return entries;
    }

    /** Résout le site depuis l'hôte : sous-domaine direct `{slug}.clenzy.site` ou domaine custom ACTIVE. */
    private Site resolveSite(String hostname) {
        if (hostname == null || hostname.isBlank()) {
            return null;
        }
        String host = hostname.trim().toLowerCase(Locale.ROOT);
        int colon = host.indexOf(':');
        if (colon > 0) {
            host = host.substring(0, colon);
        }
        if (host.endsWith(BASE_SUFFIX)) {
            String slug = host.substring(0, host.length() - BASE_SUFFIX.length());
            if (slug.isEmpty() || slug.contains(".")) {
                return null; // uniquement un sous-domaine direct
            }
            return siteRepository.findBySlug(slug).orElse(null);
        }
        return domainRepository.findByHostname(host)
            .filter(d -> d.getStatus() == SiteDomainStatus.ACTIVE)
            .flatMap(d -> siteRepository.findById(d.getSiteId()))
            .orElse(null);
    }
}
