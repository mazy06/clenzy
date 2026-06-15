package com.clenzy.booking.service;

import com.clenzy.booking.dto.GeneratedContentDto;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Set;

/**
 * Génération IA de contenu marketing pour le Booking Engine (CLZ Domaine 2 — outils IA) :
 * descriptions de biens et meta SEO, multilingue fr/en/ar. Réutilise le socle IA existant
 * ({@link AiProviderRouter} + gating/budget {@link AiTokenBudgetService} + BYOK). Le LLM rédige
 * directement dans la langue cible. Ownership org validé (#3).
 */
@Service
public class PropertyContentAiService {

    private static final Set<String> SUPPORTED_LANGS = Set.of("fr", "en", "ar");
    private static final String PROVIDER = "anthropic";
    private static final int MAX_TOKENS_DESCRIPTION = 700;
    private static final int MAX_TOKENS_SEO = 300;

    private final PropertyRepository propertyRepository;
    private final TenantContext tenantContext;
    private final AiProviderRouter aiProviderRouter;
    private final AiTokenBudgetService tokenBudgetService;

    public PropertyContentAiService(PropertyRepository propertyRepository,
                                    TenantContext tenantContext,
                                    AiProviderRouter aiProviderRouter,
                                    AiTokenBudgetService tokenBudgetService) {
        this.propertyRepository = propertyRepository;
        this.tenantContext = tenantContext;
        this.aiProviderRouter = aiProviderRouter;
        this.tokenBudgetService = tokenBudgetService;
    }

    /** Génère une description commerciale du bien dans la langue demandée. */
    public GeneratedContentDto generateDescription(Long propertyId, String language, String tone) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Property property = loadOwned(propertyId, orgId);
        String lang = normalizeLang(language);
        String system = "Tu es un redacteur specialise en location courte duree. Redige une description "
            + "commerciale, fluide et FACTUELLE (n'invente aucun fait absent des attributs) en " + langName(lang) + ". "
            + "Ton: " + (tone != null && !tone.isBlank() ? tone.trim() : "chaleureux et professionnel")
            + ". 80-140 mots, un seul paragraphe, sans titre ni liste a puces.";
        String content = run(orgId, system, facts(property), MAX_TOKENS_DESCRIPTION);
        return new GeneratedContentDto("DESCRIPTION", lang, null, content);
    }

    /** Génère un titre SEO + une meta description dans la langue demandée. */
    public GeneratedContentDto generateSeoMeta(Long propertyId, String language) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Property property = loadOwned(propertyId, orgId);
        String lang = normalizeLang(language);
        String system = "Tu es un expert SEO. A partir des attributs du logement, produis un titre SEO "
            + "(<= 60 caracteres) et une meta description (<= 155 caracteres) en " + langName(lang) + ", "
            + "attractifs et factuels. Repond STRICTEMENT au format :\nTITLE: <titre>\nMETA: <meta description>";
        String raw = run(orgId, system, facts(property), MAX_TOKENS_SEO);
        String title = extract(raw, "TITLE:");
        String meta = extract(raw, "META:");
        return new GeneratedContentDto("SEO_META", lang, title, meta != null ? meta : raw);
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

    private Property loadOwned(Long propertyId, Long orgId) {
        Property p = propertyRepository.findById(propertyId)
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + propertyId));
        // Audit #3 : findById contourne le filtre Hibernate -> valider l'org explicitement.
        if (p.getOrganizationId() == null || !p.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Propriete " + propertyId + " hors organisation");
        }
        return p;
    }

    private String facts(Property p) {
        StringBuilder sb = new StringBuilder();
        sb.append("Nom: ").append(p.getName() != null ? p.getName() : "").append("\n");
        if (p.getType() != null) sb.append("Type: ").append(p.getType().name()).append("\n");
        if (p.getCity() != null) sb.append("Ville: ").append(p.getCity()).append("\n");
        if (p.getCountry() != null) sb.append("Pays: ").append(p.getCountry()).append("\n");
        if (p.getBedroomCount() != null) sb.append("Chambres: ").append(p.getBedroomCount()).append("\n");
        if (p.getBathroomCount() != null) sb.append("Salles de bain: ").append(p.getBathroomCount()).append("\n");
        if (p.getMaxGuests() != null) sb.append("Capacite: ").append(p.getMaxGuests()).append(" voyageurs\n");
        if (p.getSquareMeters() != null) sb.append("Surface: ").append(p.getSquareMeters()).append(" m2\n");
        if (p.getAmenities() != null && !p.getAmenities().isBlank()) {
            sb.append("Equipements: ").append(p.getAmenities()).append("\n");
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
            default -> "francais";
        };
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
