package com.clenzy.service;

import com.clenzy.config.ai.AiRequest;
import com.clenzy.dto.GeneratedGuideDto;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;

/**
 * Génération IA d'un brouillon de livret d'accueil (« champ IA » du Studio livret). Réutilise l'infra IA
 * partagée (AiProviderRouter + gating/budget {@link AiTokenBudgetService} + BYOK), feature dédiée
 * {@link AiFeature#STUDIO_ASSIST} (toggle « Assistant de création » des Paramètres IA). Sortie JSON
 * structurée parsée en {@link GeneratedGuideDto} (welcomeMessage + sections au format
 * {@code WelcomeGuide.sections}) ; le front pré-remplit le formulaire, l'hôte ajuste avant publication.
 */
@Service
public class WelcomeGuideContentAiService {

    private static final String PROVIDER = "anthropic";
    private static final int MAX_TOKENS = 2500;
    private static final Set<String> SUPPORTED_LANGS = Set.of("fr", "en", "ar");

    private final AiProviderRouter aiProviderRouter;
    private final AiTokenBudgetService tokenBudgetService;
    private final ObjectMapper objectMapper;

    public WelcomeGuideContentAiService(AiProviderRouter aiProviderRouter,
                                        AiTokenBudgetService tokenBudgetService,
                                        ObjectMapper objectMapper) {
        this.aiProviderRouter = aiProviderRouter;
        this.tokenBudgetService = tokenBudgetService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public GeneratedGuideDto generate(Long orgId, String prompt, String language) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("Description requise");
        }
        String lang = normalizeLang(language);
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.STUDIO_ASSIST);
        var key = aiProviderRouter.resolveKey(orgId, PROVIDER, AiFeature.STUDIO_ASSIST);
        tokenBudgetService.requireBudget(orgId, AiFeature.STUDIO_ASSIST, key.source());

        AiRequest request = AiRequest.withMaxTokens(buildSystem(lang), prompt.trim(), MAX_TOKENS);
        RoutedResponse routed = aiProviderRouter.route(orgId, PROVIDER, AiFeature.STUDIO_ASSIST, request);
        tokenBudgetService.recordUsage(orgId, AiFeature.STUDIO_ASSIST, routed.providerName(), routed.response());
        return parse(routed.response().content());
    }

    private String buildSystem(String lang) {
        return "Tu es un expert de l'accueil en location courte durée. À partir de la description (ou du lien "
            + "d'annonce) fournie, rédige un BROUILLON de livret d'accueil en " + langName(lang) + ". Réponds "
            + "STRICTEMENT en JSON, sans aucun texte autour, au format : {\"welcomeMessage\": string (2-3 phrases "
            + "d'accueil chaleureuses), \"sections\": [ {\"icon\": string (nom d'icône lucide en minuscules : sofa, "
            + "wifi, key-round, map-pin, utensils, scroll-text, sparkles, coffee, tv), \"title\": string, "
            + "\"subtitle\": string court, \"layout\": \"text\"|\"steps\"|\"rules\"|\"list\", \"items\": [ {\"icon\": "
            + "string, \"label\": string, \"detail\": string (optionnel), \"steps\": [string] (optionnel, pour "
            + "layout steps)} ] } ], \"area\": string (ville et/ou quartier déduit de la description, ex. "
            + "\"Marrakech, médina\" — sert au géocodage), \"pois\": [ {\"category\": string (code MAJUSCULE parmi "
            + "RESTAURANT, CAFE, BAR, GROCERY, ATTRACTION, PHARMACY, TRANSPORT, ACTIVITY, SHOP), \"name\": string, "
            + "\"type\": string court (libellé), \"note\": string (conseil utile)} ] }. Génère 3 à 5 sections "
            + "utiles (logement & équipements, wifi & accès, règlement intérieur) ET 4 à 6 recommandations du "
            + "quartier (pois) adaptées au lieu décrit. Pour les lieux PUBLICS (ATTRACTION, TRANSPORT, ACTIVITY), "
            + "utilise des noms RÉELS et bien connus de la zone (géocodables, ex. « Jardin Majorelle », « Gare de "
            + "Marrakech ») ; pour les commerces PRIVÉS (RESTAURANT, CAFE, BAR, GROCERY, PHARMACY, SHOP), utilise "
            + "des noms génériques descriptifs (ex. « Restaurant marocain traditionnel ») que l'hôte précisera. "
            + "N'invente AUCUN fait chiffré précis (codes d'accès, mot de passe wifi) : placeholders entre crochets.";
    }

    private GeneratedGuideDto parse(String raw) {
        try {
            JsonNode n = objectMapper.readTree(stripFences(raw));
            if (n.isObject()) {
                JsonNode wm = n.get("welcomeMessage");
                String welcomeMessage = wm != null && wm.isTextual() && !wm.asText().isBlank() ? wm.asText().trim() : null;
                JsonNode sec = n.get("sections");
                String sections = sec != null && sec.isArray() ? objectMapper.writeValueAsString(sec) : "[]";
                JsonNode poisNode = n.get("pois");
                String pois = poisNode != null && poisNode.isArray() ? objectMapper.writeValueAsString(poisNode) : "[]";
                JsonNode areaNode = n.get("area");
                String area = areaNode != null && areaNode.isTextual() ? areaNode.asText().trim() : null;
                return new GeneratedGuideDto(welcomeMessage, sections, pois, area);
            }
        } catch (Exception ignored) {
            // JSON inattendu → brouillon vide (le front garde le formulaire en l'état)
        }
        return new GeneratedGuideDto(null, "[]", "[]", null);
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
}
