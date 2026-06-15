package com.clenzy.booking.service;

import com.clenzy.booking.dto.GeneratedArticleDto;
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
    private static final int MAX_TOKENS_ARTICLE = 1600;
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

    /**
     * Génère un brouillon d'article de blog (2.13) à partir d'un sujet libre. Réutilise l'infra IA
     * partagée (feature CONTENT, gating/budget/BYOK). Sortie JSON structurée parsée en
     * {@link GeneratedArticleDto} ; le front pré-remplit l'éditeur et l'hôte valide avant publication.
     */
    @Transactional(readOnly = true)
    public GeneratedArticleDto generateBlogArticle(Long orgId, Long siteId, String topic, String locale) {
        Site site = siteRepository.findByIdAndOrganizationId(siteId, orgId)
            .orElseThrow(() -> new NotFoundException("Site introuvable: " + siteId));
        if (topic == null || topic.isBlank()) {
            throw new IllegalArgumentException("Sujet requis");
        }
        String lang = normalizeLang(locale != null ? locale : site.getDefaultLocale());
        String system = "Tu es un rédacteur web spécialisé dans la location courte durée. Rédige un article "
            + "de blog en " + langName(lang) + " sur le sujet fourni : engageant, factuel (n'invente aucun "
            + "fait chiffré), 400–600 mots, structuré (markdown : sous-titres ##, listes). Réponds STRICTEMENT "
            + "en JSON sans texte autour, clés : {\"title\": string, \"excerpt\": string (<=160 car.), "
            + "\"body\": string markdown, \"seoTitle\": string (<=60 car.), \"seoDescription\": string (<=155 car.)}.";
        StringBuilder user = new StringBuilder("Sujet: ").append(topic.trim());
        if (site.getName() != null) {
            user.append("\nSite: ").append(site.getName());
        }
        return parseArticle(run(orgId, system, user.toString(), MAX_TOKENS_ARTICLE), topic.trim());
    }

    private GeneratedArticleDto parseArticle(String raw, String fallbackTitle) {
        try {
            JsonNode n = objectMapper.readTree(stripFences(raw));
            if (n.isObject()) {
                return new GeneratedArticleDto(
                    nodeText(n, "title", fallbackTitle), nodeText(n, "excerpt", null),
                    nodeText(n, "body", raw), nodeText(n, "seoTitle", null), nodeText(n, "seoDescription", null));
            }
        } catch (Exception ignored) {
            // JSON inattendu → repli : tout le texte en corps
        }
        return new GeneratedArticleDto(fallbackTitle, null, raw, null, null);
    }

    private static String nodeText(JsonNode n, String key, String def) {
        JsonNode v = n.get(key);
        return v != null && v.isTextual() && !v.asText().isBlank() ? v.asText().trim() : def;
    }

    /** Retire d'éventuelles balises de bloc de code ```json … ``` autour de la réponse. */
    private static String stripFences(String s) {
        if (s == null) return "";
        String t = s.trim();
        if (t.startsWith("```")) {
            int nl = t.indexOf('\n');
            if (nl > 0) t = t.substring(nl + 1);
            if (t.endsWith("```")) t = t.substring(0, t.length() - 3);
        }
        return t.trim();
    }

    private String run(Long orgId, String systemPrompt, String userPrompt) {
        return run(orgId, systemPrompt, userPrompt, MAX_TOKENS_SEO);
    }

    private String run(Long orgId, String systemPrompt, String userPrompt, int maxTokens) {
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.CONTENT);
        var key = aiProviderRouter.resolveKey(orgId, PROVIDER, AiFeature.CONTENT);
        tokenBudgetService.requireBudget(orgId, AiFeature.CONTENT, key.source());
        AiRequest request = AiRequest.withMaxTokens(systemPrompt, userPrompt, maxTokens);
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
