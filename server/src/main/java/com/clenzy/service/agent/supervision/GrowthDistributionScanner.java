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
    private final com.clenzy.service.ListingQualityService listingQualityService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final SupervisionSuggestionService suggestionService;

    public GrowthDistributionScanner(SiteRepository siteRepository,
                                     SitePageRepository sitePageRepository,
                                     PropertyRepository propertyRepository,
                                     com.clenzy.service.ListingQualityService listingQualityService,
                                     com.fasterxml.jackson.databind.ObjectMapper objectMapper,
                                     SupervisionSuggestionService suggestionService) {
        this.siteRepository = siteRepository;
        this.sitePageRepository = sitePageRepository;
        this.propertyRepository = propertyRepository;
        this.listingQualityService = listingQualityService;
        this.objectMapper = objectMapper;
        this.suggestionService = suggestionService;
    }

    /** Seuil sous lequel le score qualité d'annonce lève une carte (M3, vague M-A). */
    static final int QUALITY_CARD_THRESHOLD = 50;

    /** Évalue les règles : score qualité PAR logement, traductions sur l'ancre org. */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            scanListingQuality(orgId, propertyId);
        } catch (Exception e) {
            log.debug("listing quality scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
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

    /**
     * M3 — score qualité v1 (heuristique, persisté) : score < {@value #QUALITY_CARD_THRESHOLD}
     * → carte INFO avec les deux axes les plus faibles. La carte ne prescrit pas de
     * shooting (aucun prestataire modélisé) : elle nomme ce qui pénalise l'annonce.
     */
    private void scanListingQuality(Long orgId, Long propertyId) {
        final com.clenzy.model.ListingQualityScore stored =
                listingQualityService.computeAndStore(orgId, propertyId);
        if (stored == null || stored.getScore() >= QUALITY_CARD_THRESHOLD) {
            return;
        }
        String axes = "";
        try {
            final var node = objectMapper.readTree(stored.getBreakdown());
            axes = com.clenzy.service.ListingQualityService.weakestAxes(
                    node.path("photosPoints").asInt(), node.path("descriptionPoints").asInt(),
                    node.path("amenitiesPoints").asInt(), node.path("ratingPoints").asInt());
        } catch (Exception ignored) {
            // breakdown illisible : la carte reste valable sans le détail des axes
        }
        suggestionService.record(orgId, propertyId, MODULE_GRO, "listing_quality_low",
                "Score d'annonce " + stored.getScore() + "/100",
                "L'annonce convertit moins bien qu'elle ne le pourrait"
                        + (axes.isEmpty() ? "" : " — points faibles : " + axes)
                        + ". Compléter la fiche du logement (photos, description, équipements) "
                        + "fait remonter le score au prochain passage.");
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
