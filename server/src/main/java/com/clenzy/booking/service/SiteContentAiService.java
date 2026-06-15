package com.clenzy.booking.service;

import com.clenzy.booking.dto.GeneratedSeoDto;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SitePage;
import com.clenzy.booking.repository.SitePageRepository;
import com.clenzy.booking.repository.SiteRepository;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.AiTokenBudgetService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;

/**
 * Génération IA de contenu pour les sites hébergés (2.13). Phase 1 : SEO d'une page (titre + meta)
 * à partir de son titre + du texte de ses blocs. Réutilise l'infra IA partagée (AiProviderRouter +
 * gating/budget {@link AiTokenBudgetService} + BYOK), feature {@link AiFeature#CONTENT}. Ownership
 * org via {@code ...AndOrganizationId} (audit #3).
 */
@Service
public class SiteContentAiService {

    private static final String PROVIDER = "anthropic";
    private static final int MAX_TOKENS_SEO = 300;
    private static final Set<String> SUPPORTED_LANGS = Set.of("fr", "en", "ar");
    /** Clés de props à ignorer (URLs, couleurs…) — pas du contenu rédactionnel. */
    private static final Set<String> SKIP_KEY_HINTS = Set.of("url", "image", "color", "bg", "icon");

    private final SiteRepository siteRepository;
    private final SitePageRepository pageRepository;
    private final AiProviderRouter aiProviderRouter;
    private final AiTokenBudgetService tokenBudgetService;
    private final ObjectMapper objectMapper;

    public SiteContentAiService(SiteRepository siteRepository,
                                SitePageRepository pageRepository,
                                AiProviderRouter aiProviderRouter,
                                AiTokenBudgetService tokenBudgetService,
                                ObjectMapper objectMapper) {
        this.siteRepository = siteRepository;
        this.pageRepository = pageRepository;
        this.aiProviderRouter = aiProviderRouter;
        this.tokenBudgetService = tokenBudgetService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public GeneratedSeoDto generatePageSeo(Long orgId, Long siteId, Long pageId) {
        Site site = siteRepository.findByIdAndOrganizationId(siteId, orgId)
            .orElseThrow(() -> new NotFoundException("Site introuvable: " + siteId));
        SitePage page = pageRepository.findByIdAndSiteId(pageId, siteId)
            .orElseThrow(() -> new NotFoundException("Page introuvable: " + pageId));

        String lang = normalizeLang(page.getLocale() != null ? page.getLocale() : site.getDefaultLocale());
        String context = buildContext(site, page);

        String system = "Tu es un expert SEO. À partir du contexte de la page web ci-dessous, produis un "
            + "titre SEO (<= 60 caractères) et une meta description (<= 155 caractères) en " + langName(lang)
            + ", attractifs et factuels (n'invente aucun fait). Réponds STRICTEMENT au format :\n"
            + "TITLE: <titre>\nMETA: <meta description>";
        String raw = run(orgId, system, context);
        return new GeneratedSeoDto(extract(raw, "TITLE:"), extractMeta(raw));
    }

    private String run(Long orgId, String systemPrompt, String userPrompt) {
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.CONTENT);
        var key = aiProviderRouter.resolveKey(orgId, PROVIDER, AiFeature.CONTENT);
        tokenBudgetService.requireBudget(orgId, AiFeature.CONTENT, key.source());
        AiRequest request = AiRequest.withMaxTokens(systemPrompt, userPrompt, MAX_TOKENS_SEO);
        RoutedResponse routed = aiProviderRouter.route(orgId, PROVIDER, AiFeature.CONTENT, request);
        tokenBudgetService.recordUsage(orgId, AiFeature.CONTENT, routed.providerName(), routed.response());
        String content = routed.response().content();
        return content != null ? content.trim() : "";
    }

    /** Contexte rédactionnel : nom du site + titre/chemin de la page + texte des blocs. */
    private String buildContext(Site site, SitePage page) {
        StringBuilder sb = new StringBuilder();
        if (site.getName() != null) sb.append("Site: ").append(site.getName()).append("\n");
        if (page.getTitle() != null) sb.append("Page: ").append(page.getTitle()).append("\n");
        if (page.getPath() != null) sb.append("Chemin: ").append(page.getPath()).append("\n");
        String blocksText = extractBlocksText(page.getBlocks());
        if (!blocksText.isBlank()) sb.append("Contenu:\n").append(blocksText);
        return sb.toString();
    }

    private String extractBlocksText(String blocksJson) {
        if (blocksJson == null || blocksJson.isBlank()) return "";
        StringBuilder sb = new StringBuilder();
        try {
            JsonNode arr = objectMapper.readTree(blocksJson);
            if (arr.isArray()) {
                for (JsonNode block : arr) {
                    JsonNode props = block.path("props");
                    if (!props.isObject()) continue;
                    props.fields().forEachRemaining(e -> {
                        if (!e.getValue().isTextual()) return;
                        String keyLower = e.getKey().toLowerCase(Locale.ROOT);
                        if (SKIP_KEY_HINTS.stream().anyMatch(keyLower::contains)) return;
                        String v = e.getValue().asText().trim();
                        if (v.isEmpty() || v.startsWith("http") || v.startsWith("#") || v.length() > 600) return;
                        sb.append(v).append("\n");
                    });
                }
            }
        } catch (Exception ignored) {
            // JSON inattendu → contexte sans le détail des blocs
        }
        return sb.toString();
    }

    private String normalizeLang(String language) {
        if (language == null) return "fr";
        String l = language.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_LANGS.contains(l) ? l : "fr";
    }

    private String langName(String lang) {
        return switch (lang) {
            case "en" -> "anglais";
            case "ar" -> "arabe";
            default -> "français";
        };
    }

    private String extractMeta(String raw) {
        String meta = extract(raw, "META:");
        return meta != null ? meta : raw;
    }

    private String extract(String raw, String marker) {
        if (raw == null) return null;
        for (String line : raw.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.regionMatches(true, 0, marker, 0, marker.length())) {
                return trimmed.substring(marker.length()).trim();
            }
        }
        return null;
    }
}
