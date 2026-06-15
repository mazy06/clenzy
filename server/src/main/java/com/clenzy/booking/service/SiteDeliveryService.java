package com.clenzy.booking.service;

import com.clenzy.booking.dto.SitePagePublicDto;
import com.clenzy.booking.dto.SitePublicDto;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SiteDomainStatus;
import com.clenzy.booking.model.SitePage;
import com.clenzy.booking.model.SiteStatus;
import com.clenzy.booking.repository.SiteDomainRepository;
import com.clenzy.booking.repository.SitePageRepository;
import com.clenzy.booking.repository.SiteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public SiteDeliveryService(SiteRepository siteRepository,
                               SitePageRepository pageRepository,
                               SiteDomainRepository domainRepository) {
        this.siteRepository = siteRepository;
        this.pageRepository = pageRepository;
        this.domainRepository = domainRepository;
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
        return Optional.of(SitePublicDto.from(site, pages));
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
