package com.clenzy.service.agent.supervision;

import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SitePage;
import com.clenzy.booking.model.SiteStatus;
import com.clenzy.booking.repository.SitePageRepository;
import com.clenzy.booking.repository.SiteRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Règle de scan DÉTERMINISTE distribution (agent Croissance « gro ») : pour chaque site
 * vitrine de l'org, une langue ACTIVÉE sans variante de page → carte
 * {@code SITE_TRANSLATION_DRAFT} « Traduire » — les brouillons de traduction sont
 * générés à l'apply (JAMAIS publiés : la relecture reste dans le Studio).
 *
 * <p>Les sites sont ORG-level alors que la file est per-property : la carte est ancrée
 * sur le plus petit logement de l'org (une seule carte, pas une par logement scanné).
 * Seules les pages PUBLIÉES de la langue source comptent (traduire des brouillons
 * serait du gaspillage LLM). Dédup par intitulé. Best-effort.</p>
 */
@Service
public class GrowthDistributionScanner {

    private static final Logger log = LoggerFactory.getLogger(GrowthDistributionScanner.class);
    private static final String MODULE_GRO = "gro";

    private final SiteRepository siteRepository;
    private final SitePageRepository sitePageRepository;
    private final PropertyRepository propertyRepository;
    private final SupervisionSuggestionService suggestionService;

    public GrowthDistributionScanner(SiteRepository siteRepository,
                                     SitePageRepository sitePageRepository,
                                     PropertyRepository propertyRepository,
                                     SupervisionSuggestionService suggestionService) {
        this.siteRepository = siteRepository;
        this.sitePageRepository = sitePageRepository;
        this.propertyRepository = propertyRepository;
        this.suggestionService = suggestionService;
    }

    /** Évalue la règle (ancrée sur le plus petit logement de l'org). */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            if (!propertyId.equals(propertyRepository.findFirstPropertyIdByOrg(orgId))) {
                return; // une seule ancre org-level — pas une carte par logement scanné
            }
            for (Site site : siteRepository.findByOrganizationId(orgId)) {
                scanSite(orgId, propertyId, site);
            }
        } catch (Exception e) {
            log.debug("growth translation scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    private void scanSite(Long orgId, Long anchorPropertyId, Site site) {
        final String defaultLocale = site.getDefaultLocale() != null ? site.getDefaultLocale() : "fr";
        final List<String> targets = Arrays.stream(
                        (site.getLocales() != null ? site.getLocales() : "").split(","))
                .map(l -> l.strip().toLowerCase(Locale.ROOT))
                .filter(l -> !l.isEmpty() && !l.equals(defaultLocale))
                .toList();
        if (targets.isEmpty()) {
            return;
        }
        final List<SitePage> pages = sitePageRepository.findBySiteIdOrderBySortOrderAsc(site.getId());
        final List<SitePage> sourcePages = pages.stream()
                .filter(p -> p.getStatus() == SiteStatus.PUBLISHED)
                .filter(p -> p.getLocale() == null || defaultLocale.equals(p.getLocale()))
                .toList();
        if (sourcePages.isEmpty()) {
            return;
        }
        for (String target : targets) {
            final Set<String> coveredPaths = pages.stream()
                    .filter(p -> target.equals(p.getLocale()))
                    .map(SitePage::getPath)
                    .collect(Collectors.toSet());
            final long missing = sourcePages.stream()
                    .filter(p -> !coveredPaths.contains(p.getPath()))
                    .count();
            if (missing == 0) {
                continue;
            }
            suggestionService.recordActionable(
                    orgId, anchorPropertyId, MODULE_GRO,
                    "Traduction " + target.toUpperCase(Locale.ROOT) + " à générer — site « "
                            + site.getName() + " »",
                    missing + " page(s) publiée(s) sans variante " + target + " alors que la langue "
                            + "est activée sur le site. « Traduire » génère les brouillons — rien "
                            + "n'est publié : la relecture et la mise en ligne restent dans le Studio.",
                    SupervisionActionType.SITE_TRANSLATION_DRAFT,
                    "{\"siteId\":" + site.getId() + ",\"targetLocale\":\"" + target + "\"}",
                    null, "info");
        }
    }
}
