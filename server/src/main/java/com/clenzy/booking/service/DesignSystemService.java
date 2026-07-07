package com.clenzy.booking.service;

import com.clenzy.booking.dto.DesignSystemCreateRequest;
import com.clenzy.booking.dto.DesignSystemDto;
import com.clenzy.booking.model.DesignSystem;
import com.clenzy.booking.repository.DesignSystemRepository;
import com.clenzy.booking.service.WebsiteFetchService.WebsiteContent;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.SiteGenerationException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.service.NotificationService;
import com.clenzy.service.ResolvedTarget;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.CssSanitizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Systèmes de design réutilisables (direction : tokens {@code --bt-*} + {@code DESIGN.md} prose). Création
 * multi-sources (DS-2), inspirée d'open-design :
 * <ul>
 *   <li>{@code MANUAL} — prose et/ou tokens fournis directement.</li>
 *   <li>{@code BRAND}  — description de marque → LLM génère prose + tokens.</li>
 *   <li>{@code PASTE}  — DESIGN.md collé (réutilisé) → LLM en dérive les tokens.</li>
 *   <li>{@code URL}    — site web analysé ({@link WebsiteFetchService}, SSRF-safe) → prose + tokens.</li>
 * </ul>
 *
 * <p>Audit : l'appel LLM se fait HORS transaction (règle #2) ; feature {@code DESIGN} gatée + budget ;
 * échec explicite (#7). La portée GLOBAL est réservée au staff plateforme.</p>
 */
@Service
public class DesignSystemService {

    private static final Logger log = LoggerFactory.getLogger(DesignSystemService.class);
    private static final String PROVIDER = "anthropic";

    private final DesignSystemRepository repository;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;
    private final WebsiteFetchService websiteFetchService;
    private final AiProviderRouter aiProviderRouter;
    private final AiTokenBudgetService tokenBudgetService;
    private final NotificationService notificationService;

    public DesignSystemService(DesignSystemRepository repository, TenantContext tenantContext,
                               ObjectMapper objectMapper, WebsiteFetchService websiteFetchService,
                               AiProviderRouter aiProviderRouter, AiTokenBudgetService tokenBudgetService,
                               NotificationService notificationService) {
        this.repository = repository;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
        this.websiteFetchService = websiteFetchService;
        this.aiProviderRouter = aiProviderRouter;
        this.tokenBudgetService = tokenBudgetService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<DesignSystemDto> list() {
        Long orgId = tenantContext.getOrganizationId();
        List<DesignSystem> systems = tenantContext.isSuperAdmin()
            ? repository.findVisibleTo(orgId)
            : repository.findVisiblePublishedTo(orgId);
        return systems.stream().map(DesignSystemDto::from).toList();
    }

    @Transactional(readOnly = true)
    public DesignSystemDto get(Long id) {
        return DesignSystemDto.from(requireVisible(id));
    }

    /**
     * Crée un système de design. L'appel LLM (BRAND / PASTE / URL) se fait HORS transaction ; la
     * persistance finale est une écriture courte via {@code repository.save}.
     */
    public DesignSystemDto create(DesignSystemCreateRequest req, String createdBy) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("Le nom du système de design est requis.");
        }
        final boolean global = "GLOBAL".equalsIgnoreCase(req.scope());
        if (global && !tenantContext.isSuperAdmin()) {
            throw new AccessDeniedException("Le catalogue global est réservé au staff plateforme.");
        }

        // COMBINÉ (modèle open-design) : on agrège TOUT le contexte fourni — site web, description de
        // marque, DESIGN.md collé, réglages manuels — en une seule génération cohérente. Les réglages
        // manuels priment toujours sur les tokens dérivés par l'IA.
        final boolean hasUrl = !blank(req.websiteUrl());
        final boolean hasBrand = !blank(req.brandDescription());
        final boolean hasMarkdown = !blank(req.designMarkdown());
        final Map<String, String> manualTokens = parseTokensJson(req.tokensJson());
        final boolean hasTokens = !manualTokens.isEmpty();
        if (!hasUrl && !hasBrand && !hasMarkdown && !hasTokens) {
            throw new IllegalArgumentException(
                "Fournissez au moins une source : site web, description de marque, DESIGN.md ou réglages manuels.");
        }

        String designMarkdown = null;
        String sourceRef = hasUrl ? req.websiteUrl() : null;
        final Map<String, String> tokens = new LinkedHashMap<>();

        if (hasUrl || hasBrand || hasMarkdown) {
            String html = "";
            String css = "";
            if (hasUrl) {
                try {
                    WebsiteContent content = websiteFetchService.fetchWebsite(req.websiteUrl());
                    html = content.html();
                    css = content.css();
                } catch (Exception e) {
                    throw new IllegalArgumentException("Impossible d'analyser ce site : " + e.getMessage(), e);
                }
            }
            GeneratedDesign g = callLlm(orgIdRequired(),
                DesignSystemPrompts.buildCombined(req.brandDescription(), html, css, req.designMarkdown()));
            // DESIGN.md fourni SEUL (sans autre source IA) → on conserve la prose de l'utilisateur telle quelle.
            designMarkdown = (hasMarkdown && !hasUrl && !hasBrand) ? req.designMarkdown() : g.markdown();
            tokens.putAll(g.tokens());
        }
        // Réglages manuels : dernier mot sur la palette/typo.
        tokens.putAll(manualTokens);

        final String sourceType = hasUrl ? "URL" : hasBrand ? "BRAND" : hasMarkdown ? "PASTE" : "MANUAL";

        DesignSystem d = new DesignSystem();
        d.setOrganizationId(global ? null : tenantContext.getRequiredOrganizationId());
        d.setName(req.name().trim());
        d.setCategory(req.category());
        d.setDescription(req.description());
        d.setStatus("PUBLISHED");
        d.setDesignMarkdown(designMarkdown);
        d.setTokensJson(serializeTokens(tokens));
        d.setSourceType(sourceType);
        d.setSourceRef(sourceRef);
        d.setCreatedBy(createdBy);
        return DesignSystemDto.from(repository.save(d));
    }

    @Transactional
    public void delete(Long id) {
        DesignSystem d = repository.findById(id)
            .orElseThrow(() -> new NotFoundException("Système de design introuvable: " + id));
        if (d.getOrganizationId() == null) {
            if (!tenantContext.isSuperAdmin()) {
                throw new AccessDeniedException("Suppression d'un système global réservée au staff plateforme.");
            }
        } else {
            Long orgId = tenantContext.getOrganizationId();
            boolean owner = orgId != null && orgId.equals(d.getOrganizationId());
            if (!owner && !tenantContext.isSuperAdmin()) {
                throw new AccessDeniedException("Vous ne pouvez supprimer que les systèmes de votre organisation.");
            }
        }
        repository.delete(d);
    }

    // ─── LLM ──────────────────────────────────────────────────────────────────

    private record GeneratedDesign(String markdown, Map<String, String> tokens) {}

    private GeneratedDesign callLlm(Long orgId, String userPrompt) {
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.DESIGN);
        final ResolvedTarget key;
        try {
            key = aiProviderRouter.resolveKey(orgId, PROVIDER, AiFeature.DESIGN);
        } catch (AiNotConfiguredException e) {
            notifyNoUsableModel();
            throw e;
        }
        tokenBudgetService.requireBudget(orgId, AiFeature.DESIGN, key.source());

        AiRequest request = AiRequest.jsonWithMaxTokens(
            DesignSystemPrompts.SYSTEM_PROMPT, userPrompt, DesignSystemPrompts.MAX_TOKENS);
        final RoutedResponse routed;
        try {
            routed = aiProviderRouter.route(orgId, PROVIDER, AiFeature.DESIGN, request);
        } catch (RuntimeException e) {
            throw new SiteGenerationException("Échec de l'appel IA pour le système de design", e);
        }
        tokenBudgetService.recordUsage(orgId, AiFeature.DESIGN, routed.providerName(), routed.response());

        String content = routed.response() != null ? routed.response().content() : null;
        return parse(content);
    }

    private GeneratedDesign parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new SiteGenerationException("Réponse IA vide");
        }
        final JsonNode root;
        try {
            root = objectMapper.readTree(stripFences(raw));
        } catch (Exception e) {
            throw new SiteGenerationException("Réponse IA illisible (JSON attendu)", e);
        }
        String markdown = root.path("designMarkdown").asText(null);
        Map<String, String> tokens = parseTokensNode(root.get("tokens"));
        if ((markdown == null || markdown.isBlank()) && tokens.isEmpty()) {
            throw new SiteGenerationException("Réponse IA sans direction exploitable");
        }
        return new GeneratedDesign(markdown, tokens);
    }

    private Map<String, String> parseTokensNode(JsonNode node) {
        if (node == null || !node.isObject()) {
            return Map.of();
        }
        Map<String, String> raw = new LinkedHashMap<>();
        node.fields().forEachRemaining(e -> {
            if (e.getValue() != null && e.getValue().isValueNode()) {
                raw.put(e.getKey(), e.getValue().asText());
            }
        });
        return CssSanitizer.sanitizeVarMap(raw);
    }

    private Map<String, String> parseTokensJson(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return parseTokensNode(objectMapper.readTree(json));
        } catch (Exception e) {
            throw new IllegalArgumentException("tokensJson illisible (JSON attendu).", e);
        }
    }

    private String serializeTokens(Map<String, String> tokens) {
        if (tokens == null || tokens.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(tokens);
        } catch (Exception e) {
            log.warn("Échec de sérialisation des tokens de design: {}", e.getMessage());
            return null;
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private DesignSystem requireVisible(Long id) {
        DesignSystem d = repository.findById(id)
            .orElseThrow(() -> new NotFoundException("Système de design introuvable: " + id));
        Long orgId = tenantContext.getOrganizationId();
        boolean visible = d.getOrganizationId() == null
            || (orgId != null && orgId.equals(d.getOrganizationId()))
            || tenantContext.isSuperAdmin();
        if (!visible) {
            throw new AccessDeniedException("Système de design non accessible.");
        }
        return d;
    }

    private Long orgIdRequired() {
        return tenantContext.getRequiredOrganizationId();
    }

    private void notifyNoUsableModel() {
        notificationService.notifyAllPlatformStaff(
            NotificationKey.AI_MODEL_EOL,
            "Génération de système de design indisponible",
            "Aucun modèle IA exploitable pour générer un système de design : le modèle assigné à « Design IA »"
                + " est indisponible ou absent. Vérifiez la configuration des modèles IA.",
            "/settings?tab=ai");
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    /** Isole l'objet JSON de la réponse (retire un éventuel bloc ``` et borne au 1er objet). */
    private static String stripFences(String s) {
        String t = s.trim();
        if (t.startsWith("```")) {
            int nl = t.indexOf('\n');
            if (nl > 0) {
                t = t.substring(nl + 1);
            }
            if (t.endsWith("```")) {
                t = t.substring(0, t.length() - 3);
            }
            t = t.trim();
        }
        int start = t.indexOf('{');
        int end = t.lastIndexOf('}');
        if (start >= 0 && end > start) {
            t = t.substring(start, end + 1);
        }
        return t.trim();
    }
}
