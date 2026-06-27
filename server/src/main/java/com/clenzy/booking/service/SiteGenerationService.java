package com.clenzy.booking.service;

import com.clenzy.booking.dto.DesignTokensDto;
import com.clenzy.booking.dto.SiteGenerationBrief;
import com.clenzy.booking.dto.SiteGenerationResultDto;
import com.clenzy.booking.dto.SiteGenerationResultDto.GeneratedPageSummary;
import com.clenzy.booking.dto.SitePageDto;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.repository.SiteRepository;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.SiteGenerationException;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiKeyResolver.ResolvedKey;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.util.EmailHtmlSanitizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Moteur de génération de site complet par IA (P2.a booking engine) : un brief utilisateur
 * ({@link SiteGenerationBrief}) → un site multi-pages (layout + contenu rédactionnel + SEO), au-delà de
 * la simple génération de texte. Orchestration :
 * <ol>
 *   <li><b>Thème</b> : dérive un {@link DesignTokensDto} (couleurs/typo) du brief et l'applique au
 *       {@link Site} et, s'il existe, à la {@link com.clenzy.booking.model.BookingEngineConfig} liée —
 *       comme {@code AiDesignService}.</li>
 *   <li><b>Pages</b> : UN appel LLM produit un set par défaut (HOME / PROPERTY_LIST / À PROPOS / CONTACT),
 *       chaque page en HTML sectionné cohérent avec le design system + marqueurs booking
 *       ({@code data-clenzy-widget="search"} sur HOME, {@code ="results"} sur PROPERTY_LIST). Le HTML est
 *       ré-assaini puis emballé dans l'enveloppe GrapesJS {@code {format:grapesjs, html, css, projectData:null}}.</li>
 *   <li><b>Contenu + SEO</b> : le texte rédactionnel et le SEO de chaque page viennent du LLM dans la même
 *       réponse JSON. {@link SiteContentAiService#generatePageSeo} reste disponible pour raffiner le SEO
 *       d'une page A POSTERIORI (non rappelé ici pour borner le budget tokens).</li>
 *   <li><b>Persistance</b> : chaque page est créée en {@code DRAFT} ({@code ai_generated=true}) via
 *       {@link SiteAdminService#createAiGeneratedPage} — jamais auto-publiée (relecture humaine, 2.13).</li>
 * </ol>
 *
 * <p><b>Audit</b> : l'appel LLM se fait HORS transaction DB (règle #2) — ce service n'est pas
 * {@code @Transactional} ; ownership org chargé en lecture courte ({@code ...AndOrganizationId}, règle #3) ;
 * un échec LLM/parsing lève une exception explicite (jamais avalé, règle #7) ; controller mince (règle #4) ;
 * aucune entité exposée — on renvoie un {@link SiteGenerationResultDto} (règle #5).</p>
 *
 * <p><b>Multi-langue</b> : le LLM rédige dans la langue SOURCE (1re des {@code languages} du brief). Les
 * autres locales sont produites EN SUITE par l'auto-traduction déjà livrée
 * ({@link ContentTranslationService#autoTranslatePage}) — non dupliquée ici (juste documentée).</p>
 *
 * <p><b>Sécurité du HTML</b> : le HTML généré par le LLM est ré-assaini avant persistance via
 * {@link EmailHtmlSanitizer#sanitize} (supprime {@code <script>}/{@code <iframe>}/handlers {@code on*}/
 * schemes dangereux tout en préservant les marqueurs {@code data-clenzy-*} et le layout). Le rendu
 * SSR/Studio ré-assainit également côté lecture.</p>
 */
@Service
public class SiteGenerationService {

    private static final Logger log = LoggerFactory.getLogger(SiteGenerationService.class);

    private static final String PROVIDER = "anthropic";
    private static final String GRAPES_FORMAT = "grapesjs";
    /** Borne haute du nombre de pages persistées (le prompt en demande 4 ; garde-fou anti-dérive). */
    private static final int MAX_PAGES = 6;
    /** Budget tokens de sortie de l'appel de génération (site complet = HTML volumineux). */
    private static final int MAX_TOKENS_GENERATION = 8000;

    private final SiteRepository siteRepository;
    private final BookingEngineConfigRepository configRepository;
    private final AiProviderRouter aiProviderRouter;
    private final AiTokenBudgetService tokenBudgetService;
    private final SiteAdminService siteAdminService;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<SiteGenerationService> self;

    public SiteGenerationService(SiteRepository siteRepository,
                                 BookingEngineConfigRepository configRepository,
                                 AiProviderRouter aiProviderRouter,
                                 AiTokenBudgetService tokenBudgetService,
                                 SiteAdminService siteAdminService,
                                 ObjectMapper objectMapper,
                                 ObjectProvider<SiteGenerationService> self) {
        this.siteRepository = siteRepository;
        this.configRepository = configRepository;
        this.aiProviderRouter = aiProviderRouter;
        this.tokenBudgetService = tokenBudgetService;
        this.siteAdminService = siteAdminService;
        this.objectMapper = objectMapper;
        this.self = self;
    }

    /**
     * Génère un site complet (thème + pages en BROUILLON) à partir d'un brief.
     *
     * @param orgId  organisation (ownership) ; le site doit lui appartenir.
     * @param siteId site cible (déjà créé) à peupler.
     * @param brief  cahier des charges (type de bien, ton, marque, couleur, langues).
     * @return résumé des pages créées + si un thème a été appliqué.
     * @throws NotFoundException        si le site n'appartient pas à l'org (ownership).
     * @throws IllegalArgumentException si le brief est vide.
     * @throws SiteGenerationException  si l'appel LLM ou le parsing de sa sortie échoue.
     */
    public SiteGenerationResultDto generateSite(Long orgId, Long siteId, SiteGenerationBrief brief) {
        if (brief == null || brief.propertyType() == null || brief.propertyType().isBlank()) {
            throw new IllegalArgumentException("Brief invalide : le type de bien est requis");
        }
        // 1. Ownership + données du site en LECTURE COURTE (audit #3) — pas de tx ouverte pendant le LLM.
        Site site = requireOwnedSite(orgId, siteId);
        final String sourceLanguage = resolveSourceLanguage(brief, site);
        final String brandName = resolveBrandName(brief, site);

        // 2. Gating + budget de la feature (avant tout appel LLM).
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.DESIGN);
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.CONTENT);
        ResolvedKey key = aiProviderRouter.resolveKey(orgId, PROVIDER, AiFeature.CONTENT);
        tokenBudgetService.requireBudget(orgId, AiFeature.CONTENT, key.source());

        // 3. (b)(c) Pages + contenu + SEO : UN appel LLM HORS transaction (audit #2). Étape la plus
        //    risquée → effectuée AVANT toute écriture, pour ne RIEN modifier en cas d'échec.
        GeneratedSite generated = callLlm(orgId, brief, sourceLanguage, brandName);

        // 4. (a) Thème : dérivé du brief (déterministe, sans appel LLM supplémentaire) puis appliqué.
        DesignTokensDto tokens = deriveThemeTokens(brief);
        boolean themeApplied = self.getObject().applyTheme(orgId, siteId, tokens);

        // 5. (d) Persistance : chaque page en DRAFT, ai_generated=true (transaction courte par page).
        List<GeneratedPageSummary> created = new ArrayList<>();
        int count = 0;
        for (GeneratedPage page : generated.pages()) {
            if (count++ >= MAX_PAGES) {
                break;
            }
            String envelope = wrapGrapesEnvelope(page.html(), generated.css());
            SitePageDto draft = new SitePageDto(
                null, siteId, page.path(), page.type().name(), page.title(), envelope,
                sourceLanguage, null, count - 1,
                page.seoTitle(), page.seoDescription(), null,
                null, false, true, null, null);
            SitePageDto saved = siteAdminService.createAiGeneratedPage(orgId, siteId, draft);
            created.add(new GeneratedPageSummary(
                saved.id(), saved.path(), saved.type(), saved.title(), saved.status()));
        }

        log.info("AI site generation: org={} site={} pages={} themeApplied={}",
            orgId, siteId, created.size(), themeApplied);
        return new SiteGenerationResultDto(created, themeApplied);
    }

    // ─── (a) Thème ────────────────────────────────────────────────────────────

    /**
     * Applique les design tokens au site et, s'il référence une config de widget, à cette config (même
     * source de vérité que {@code AiDesignService}). Transaction courte dédiée (séparée du LLM).
     *
     * @return {@code true} si le thème a pu être sérialisé et appliqué.
     */
    @Transactional
    public boolean applyTheme(Long orgId, Long siteId, DesignTokensDto tokens) {
        Site site = requireOwnedSite(orgId, siteId);
        String json = serializeTokens(tokens);
        if (json == null) {
            return false;
        }
        site.setDesignTokens(json);
        if (tokens.primaryColor() != null) {
            site.setPrimaryColor(tokens.primaryColor());
        }
        if (tokens.bodyFontFamily() != null) {
            site.setFontFamily(tokens.bodyFontFamily());
        }
        siteRepository.save(site);

        if (site.getBookingEngineConfigId() != null) {
            configRepository.findByIdAndOrganizationId(site.getBookingEngineConfigId(), orgId)
                .ifPresent(config -> {
                    config.setDesignTokens(json);
                    if (tokens.primaryColor() != null) {
                        config.setPrimaryColor(tokens.primaryColor());
                    }
                    if (tokens.bodyFontFamily() != null) {
                        config.setFontFamily(tokens.bodyFontFamily());
                    }
                    configRepository.save(config);
                });
        }
        return true;
    }

    /**
     * Dérive un jeu de design tokens à partir du brief. Volontairement déterministe (pas d'appel LLM) :
     * le brief fournit une couleur primaire (ou un repli) ; le reste suit une palette « product register »
     * neutre et accessible, ajustable ensuite dans le Studio. Le rendu visuel détaillé est porté par le
     * CSS généré par le LLM (variables {@code --c-*}) — ces tokens pilotent surtout le widget de réservation.
     */
    private DesignTokensDto deriveThemeTokens(SiteGenerationBrief brief) {
        String primary = normalizeColor(brief.primaryColorHint());
        return new DesignTokensDto(
            primary,                       // primaryColor
            "#2f5d4f",                     // secondaryColor
            "#c8a04e",                     // accentColor
            "#faf6ef",                     // backgroundColor
            "#fffdf9",                     // surfaceColor
            "#2b2420",                     // textColor
            "#5c5046",                     // textSecondaryColor
            "Cormorant Garamond, serif",   // headingFontFamily
            "Manrope, system-ui, sans-serif", // bodyFontFamily
            "16px",                        // baseFontSize
            "600",                         // headingFontWeight
            "14px",                        // borderRadius
            "999px",                       // buttonBorderRadius
            "14px",                        // cardBorderRadius
            "16px",                        // spacing
            "0 18px 48px -28px rgba(43,36,32,0.45)", // boxShadow
            "0 18px 48px -28px rgba(43,36,32,0.45)", // cardShadow
            "filled",                      // buttonStyle
            "none",                        // buttonTextTransform
            "#e8ddcb",                     // borderColor
            "#e8ddcb");                    // dividerColor
    }

    /** Normalise l'indice de couleur (hex tel quel ; repli sur le primary brand Clenzy si vide/non-hex). */
    private String normalizeColor(String hint) {
        if (hint == null) {
            return "#6B8A9A";
        }
        String h = hint.trim();
        if (h.matches("^#?[0-9a-fA-F]{6}$")) {
            return h.startsWith("#") ? h : "#" + h;
        }
        return "#6B8A9A";
    }

    // ─── (b)(c) Appel LLM + parsing ─────────────────────────────────────────────

    /** Effectue l'appel LLM (HORS transaction) et parse la sortie JSON en pages + CSS. */
    private GeneratedSite callLlm(Long orgId, SiteGenerationBrief brief, String sourceLanguage, String brandName) {
        AiRequest request = AiRequest.withMaxTokens(
            SiteGenerationPrompts.SYSTEM_PROMPT,
            SiteGenerationPrompts.buildUserPrompt(brief, sourceLanguage, brandName),
            MAX_TOKENS_GENERATION);

        final RoutedResponse routed;
        try {
            routed = aiProviderRouter.route(orgId, PROVIDER, AiFeature.CONTENT, request);
        } catch (RuntimeException e) {
            // Échec explicite (audit #7) : on ne crée AUCUNE page sur erreur LLM.
            throw new SiteGenerationException("Échec de l'appel IA pour la génération du site", e);
        }
        tokenBudgetService.recordUsage(orgId, AiFeature.CONTENT, routed.providerName(), routed.response());

        String content = routed.response() != null ? routed.response().content() : null;
        return parseGeneratedSite(content);
    }

    /** Parse la réponse JSON {@code {css, pages:[{path,type,title,html,seoTitle,seoDescription}]}}. */
    private GeneratedSite parseGeneratedSite(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new SiteGenerationException("Réponse IA vide");
        }
        final JsonNode root;
        try {
            root = objectMapper.readTree(stripFences(raw));
        } catch (Exception e) {
            throw new SiteGenerationException("Réponse IA illisible (JSON attendu)", e);
        }
        JsonNode pagesNode = root.path("pages");
        if (!pagesNode.isArray() || pagesNode.isEmpty()) {
            throw new SiteGenerationException("Réponse IA sans page exploitable");
        }
        String css = root.path("css").asText("");
        List<GeneratedPage> pages = new ArrayList<>();
        for (JsonNode p : pagesNode) {
            String path = text(p, "path");
            String html = text(p, "html");
            if (path == null || html == null || html.isBlank()) {
                continue; // page incomplète → ignorée (le set restant reste valide)
            }
            String sanitized = EmailHtmlSanitizer.sanitize(html); // ré-assainissement (sécurité)
            pages.add(new GeneratedPage(
                path,
                parseType(text(p, "type")),
                orDefault(text(p, "title"), path),
                sanitized,
                text(p, "seoTitle"),
                text(p, "seoDescription")));
        }
        if (pages.isEmpty()) {
            throw new SiteGenerationException("Aucune page valide dans la réponse IA");
        }
        return new GeneratedSite(css, pages);
    }

    // ─── Enveloppe GrapesJS ─────────────────────────────────────────────────────

    /**
     * Emballe le HTML + CSS d'une page dans l'enveloppe GrapesJS attendue par {@code SitePage.blocks} :
     * {@code {"format":"grapesjs","html":...,"css":...,"projectData":null}}. {@code projectData=null}
     * → le Studio auto-convertit (re-sérialise avec projectData) au 1er edit.
     */
    private String wrapGrapesEnvelope(String html, String css) {
        var node = objectMapper.createObjectNode();
        node.put("format", GRAPES_FORMAT);
        node.put("html", html);
        node.put("css", css != null ? css : "");
        node.putNull("projectData");
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            throw new SiteGenerationException("Échec de sérialisation de l'enveloppe GrapesJS", e);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Site requireOwnedSite(Long orgId, Long siteId) {
        return siteRepository.findByIdAndOrganizationId(siteId, orgId)
            .orElseThrow(() -> new NotFoundException("Site introuvable: " + siteId));
    }

    /** Langue source = 1re locale du brief si fournie, sinon la locale par défaut du site. */
    private String resolveSourceLanguage(SiteGenerationBrief brief, Site site) {
        if (brief.languages() != null && !brief.languages().isEmpty() && brief.languages().get(0) != null) {
            return brief.languages().get(0).trim().toLowerCase(Locale.ROOT);
        }
        return site.getDefaultLocale() != null ? site.getDefaultLocale() : "fr";
    }

    private String resolveBrandName(SiteGenerationBrief brief, Site site) {
        if (brief.brandName() != null && !brief.brandName().isBlank()) {
            return brief.brandName().trim();
        }
        return site.getName() != null ? site.getName() : "Notre maison";
    }

    private com.clenzy.booking.model.SitePageType parseType(String value) {
        if (value == null) {
            return com.clenzy.booking.model.SitePageType.CUSTOM;
        }
        try {
            return com.clenzy.booking.model.SitePageType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return com.clenzy.booking.model.SitePageType.CUSTOM;
        }
    }

    private String serializeTokens(DesignTokensDto tokens) {
        try {
            return objectMapper.writeValueAsString(tokens);
        } catch (Exception e) {
            log.warn("Échec de sérialisation des design tokens: {}", e.getMessage());
            return null;
        }
    }

    private static String text(JsonNode n, String key) {
        JsonNode v = n.get(key);
        return v != null && v.isTextual() && !v.asText().isBlank() ? v.asText().trim() : null;
    }

    private static String orDefault(String v, String def) {
        return v != null ? v : def;
    }

    /** Retire d'éventuelles balises de bloc de code ```json … ``` autour de la réponse. */
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
        }
        return t.trim();
    }

    // ─── Types internes (parsing) ───────────────────────────────────────────────

    private record GeneratedSite(String css, List<GeneratedPage> pages) {}

    private record GeneratedPage(
        String path,
        com.clenzy.booking.model.SitePageType type,
        String title,
        String html,
        String seoTitle,
        String seoDescription) {}
}
