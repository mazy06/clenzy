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
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.SiteGenerationException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.ResolvedTarget;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.service.NotificationService;
import com.clenzy.util.CssSanitizer;
import com.clenzy.util.EmailHtmlSanitizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Moteur de génération de site complet par IA (P2.a booking engine) : un brief utilisateur
 * ({@link SiteGenerationBrief}) → un site multi-pages (layout + contenu rédactionnel + SEO), au-delà de
 * la simple génération de texte. Orchestration :
 * <ol>
 *   <li><b>Thème</b> : dérive un {@link DesignTokensDto} (couleurs/typo) du brief et l'applique au
 *       {@link Site} et, s'il existe, à la {@link com.clenzy.booking.model.BookingEngineConfig} liée —
 *       comme {@code AiDesignService}.</li>
 *   <li><b>Pages</b> : UN appel LLM produit le set de pages DEMANDÉ dans le brief ({@code pages}, dérivé du
 *       {@code SiteGenerationPrompts.PAGE_CATALOG} ; repli sur HOME / PROPERTY_LIST / À PROPOS / CONTACT),
 *       chaque page en HTML sectionné cohérent avec le design system + marqueurs booking conditionnels
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
    /** Borne haute du nombre de pages persistées (garde-fou anti-dérive ; couvre le catalogue complet). */
    private static final int MAX_PAGES = 12;
    /** Budget tokens de sortie (site complet = HTML volumineux ; relevé pour les sets de pages étendus).
     *  NB : un set de pages très large peut malgré tout tronquer la sortie JSON — tuning à suivre. */
    private static final int MAX_TOKENS_GENERATION = 16000;

    private final SiteRepository siteRepository;
    private final BookingEngineConfigRepository configRepository;
    private final AiProviderRouter aiProviderRouter;
    private final AiTokenBudgetService tokenBudgetService;
    private final SiteAdminService siteAdminService;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<SiteGenerationService> self;

    public SiteGenerationService(SiteRepository siteRepository,
                                 BookingEngineConfigRepository configRepository,
                                 AiProviderRouter aiProviderRouter,
                                 AiTokenBudgetService tokenBudgetService,
                                 SiteAdminService siteAdminService,
                                 NotificationService notificationService,
                                 ObjectMapper objectMapper,
                                 ObjectProvider<SiteGenerationService> self) {
        this.siteRepository = siteRepository;
        this.configRepository = configRepository;
        this.aiProviderRouter = aiProviderRouter;
        this.tokenBudgetService = tokenBudgetService;
        this.siteAdminService = siteAdminService;
        this.notificationService = notificationService;
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

        // 2. Gating + budget : la génération de site = feature DESIGN (« Generation CSS/JS du booking
        //    engine » dans la config plateforme). Le provider/modèle EFFECTIF vient du modèle assigné à
        //    DESIGN (ex. Llama 3.3 70B / NVIDIA, OpenAI-compatible → response_format) ; `PROVIDER` n'est
        //    qu'un repli si DESIGN n'a pas de modèle configuré.
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.DESIGN);
        // Résolution SOURCE UNIQUE : modèle assigné à DESIGN, sinon repli sur un autre modèle configuré
        // DISPONIBLE (géré par AiTargetResolver, jamais de défaut env). Si rien d'exploitable → notif admins
        // + 422 AI_NOT_CONFIGURED → modale d'indisponibilité côté Studio.
        final ResolvedTarget key;
        try {
            key = aiProviderRouter.resolveKey(orgId, PROVIDER, AiFeature.DESIGN);
        } catch (AiNotConfiguredException e) {
            notifyNoUsableModel();
            throw e;
        }
        tokenBudgetService.requireBudget(orgId, AiFeature.DESIGN, key.source());

        // 3. (b)(c) Pages + contenu + SEO : UN appel LLM HORS transaction (audit #2). Étape la plus
        //    risquée → effectuée AVANT toute écriture, pour ne RIEN modifier en cas d'échec.
        GeneratedSite generated = ensureHomeHero(callLlm(orgId, brief, sourceLanguage, brandName), brandName);

        // 4. (a) Thème : un SEUL contrat de variables CSS (`--bt-*`) émis par le LLM pilote PAGES ET WIDGETS
        //    (map déjà assainie au parsing). On en dérive les tokens structurés (rétro-compat, primaire =
        //    couleur IMPOSÉE du brief) et un bloc `:root{}` déterministe préfixé au CSS de chaque page → les
        //    widgets (light DOM dans .site-root) héritent du MÊME design par cascade.
        Map<String, String> designVars = generated.designVars();
        DesignTokensDto tokens = mergeTokens(tokensFromVars(designVars), deriveThemeTokens(brief));
        boolean themeApplied = self.getObject().applyTheme(orgId, siteId, tokens, designVars);

        // 5. (d) Persistance : chaque page en DRAFT, ai_generated=true (transaction courte par page).
        final String pageCss = buildRootVarsBlock(designVars) + generated.css();
        List<GeneratedPageSummary> created = new ArrayList<>();
        int count = 0;
        for (GeneratedPage page : generated.pages()) {
            if (count++ >= MAX_PAGES) {
                break;
            }
            String envelope = wrapGrapesEnvelope(page.html(), pageCss);
            SitePageDto draft = new SitePageDto(
                null, siteId, page.path(), page.type().name(),
                SiteGenerationPrompts.cleanTitle(page.path(), page.title()), envelope,
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

    /** Prévient les SUPER_ADMIN / SUPER_MANAGER plateforme qu'aucun modèle IA n'est exploitable. */
    private void notifyNoUsableModel() {
        notificationService.notifyAllPlatformStaff(
            NotificationKey.AI_MODEL_EOL,
            "Génération de site IA indisponible",
            "Aucun modèle IA exploitable pour la génération de site : le modèle assigné à « Design IA » est "
                + "indisponible ou absent, et aucune clé de secours (OpenAI/Anthropic) n'est configurée. "
                + "Vérifiez la configuration des modèles IA.",
            "/settings?tab=ai");
    }

    // ─── (a) Thème ────────────────────────────────────────────────────────────

    /**
     * Applique les design tokens au site et, s'il référence une config de widget, à cette config (même
     * source de vérité que {@code AiDesignService}). Transaction courte dédiée (séparée du LLM).
     *
     * @return {@code true} si le thème a pu être sérialisé et appliqué.
     */
    @Transactional
    public boolean applyTheme(Long orgId, Long siteId, DesignTokensDto tokens, Map<String, String> designVars) {
        Site site = requireOwnedSite(orgId, siteId);
        String json = serializeTokens(tokens);
        if (json == null) {
            return false;
        }
        final String varsJson = serializeVars(designVars);
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
                    config.setDesignCssVariables(varsJson);
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

    /**
     * Fusionne les tokens du LLM ({@code llm}, partiel) sur un repli déterministe ({@code def}) : chaque
     * champ non-vide du LLM gagne, sinon le défaut. La couleur PRIMAIRE reste celle imposée par le brief
     * ({@code def.primaryColor()}) — cohérence avec la valeur épinglée dans le prompt.
     */
    private DesignTokensDto mergeTokens(DesignTokensDto llm, DesignTokensDto def) {
        if (llm == null) {
            return def;
        }
        return new DesignTokensDto(
            def.primaryColor(),
            pick(llm.secondaryColor(), def.secondaryColor()),
            pick(llm.accentColor(), def.accentColor()),
            pick(llm.backgroundColor(), def.backgroundColor()),
            pick(llm.surfaceColor(), def.surfaceColor()),
            pick(llm.textColor(), def.textColor()),
            pick(llm.textSecondaryColor(), def.textSecondaryColor()),
            pick(llm.headingFontFamily(), def.headingFontFamily()),
            pick(llm.bodyFontFamily(), def.bodyFontFamily()),
            pick(llm.baseFontSize(), def.baseFontSize()),
            pick(llm.headingFontWeight(), def.headingFontWeight()),
            pick(llm.borderRadius(), def.borderRadius()),
            pick(llm.buttonBorderRadius(), def.buttonBorderRadius()),
            pick(llm.cardBorderRadius(), def.cardBorderRadius()),
            pick(llm.spacing(), def.spacing()),
            pick(llm.boxShadow(), def.boxShadow()),
            pick(llm.cardShadow(), def.cardShadow()),
            pick(llm.buttonStyle(), def.buttonStyle()),
            pick(llm.buttonTextTransform(), def.buttonTextTransform()),
            pick(llm.borderColor(), def.borderColor()),
            pick(llm.dividerColor(), def.dividerColor()));
    }

    private static String pick(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
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
        // Couleur primaire résolue (même valeur que les design tokens) → ÉPINGLÉE dans le prompt pour que
        // le CSS de page (--c-primary) et le widget de réservation partagent EXACTEMENT la même couleur.
        final String resolvedPrimary = normalizeColor(brief.primaryColorHint());
        AiRequest request = AiRequest.jsonWithMaxTokens(
            SiteGenerationPrompts.SYSTEM_PROMPT,
            SiteGenerationPrompts.buildUserPrompt(brief, sourceLanguage, brandName, resolvedPrimary),
            MAX_TOKENS_GENERATION);

        final RoutedResponse routed;
        try {
            // Feature DESIGN → AiTargetResolver route vers le modèle assigné (ou un autre modèle configuré
            // disponible en repli) ; résolution identique à celle du budget ci-dessus.
            routed = aiProviderRouter.route(orgId, PROVIDER, AiFeature.DESIGN, request);
        } catch (RuntimeException e) {
            // Échec explicite (audit #7) : on ne crée AUCUNE page sur erreur LLM.
            throw new SiteGenerationException("Échec de l'appel IA pour la génération du site", e);
        }
        tokenBudgetService.recordUsage(orgId, AiFeature.DESIGN, routed.providerName(), routed.response());

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
        String css = CssSanitizer.sanitizeCss(root.path("css").asText(""));
        Map<String, String> designVars = parseDesignVars(root.get("designVars"));
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
        return new GeneratedSite(css, pages, designVars);
    }

    /** Parse l'objet "designVars" du LLM (map de variables CSS `--bt-*`) puis l'ASSAINIT (CssSanitizer, sécurité). */
    private Map<String, String> parseDesignVars(JsonNode node) {
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

    /** Bloc `:root{}` déterministe à partir de la map (déjà assainie) — préfixé au CSS de chaque page. */
    private String buildRootVarsBlock(Map<String, String> vars) {
        if (vars == null || vars.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder(":root{");
        vars.forEach((k, v) -> sb.append(k).append(':').append(v).append(';'));
        return sb.append("}\n").toString();
    }

    /** Dérive le {@link DesignTokensDto} structuré (rétro-compat) depuis la map `--bt-*` (champs absents → null). */
    private DesignTokensDto tokensFromVars(Map<String, String> v) {
        if (v == null || v.isEmpty()) {
            return null;
        }
        return new DesignTokensDto(
            v.get("--bt-color-primary"), v.get("--bt-color-secondary"), v.get("--bt-color-accent"),
            v.get("--bt-color-bg"), v.get("--bt-color-surface"), v.get("--bt-color-text"),
            v.get("--bt-color-text-muted"), v.get("--bt-font-heading"), v.get("--bt-font-body"),
            v.get("--bt-text-md"), v.get("--bt-heading-weight"), v.get("--bt-radius-md"),
            v.get("--bt-radius-button"), v.get("--bt-radius-card"), v.get("--bt-space-4"),
            v.get("--bt-shadow-md"), v.get("--bt-shadow-card"), null,
            v.get("--bt-button-transform"), v.get("--bt-color-border"), v.get("--bt-color-divider"));
    }

    /** Sérialise la map de variables en JSON (null si vide) pour persistance sur la config. */
    private String serializeVars(Map<String, String> vars) {
        if (vars == null || vars.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(vars);
        } catch (Exception e) {
            log.warn("Échec de sérialisation des variables CSS de design: {}", e.getMessage());
            return null;
        }
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

    // ─── Repli déterministe : hero garanti sur la HOME ──────────────────────────

    /**
     * Garantit qu'une page HOME contient un hero TEXTUEL même si le LLM (modèles légers) n'a produit que des
     * marqueurs widget (constaté en test). Idempotent : une page qui a déjà un {@code <h1>} n'est pas modifiée.
     * Le reste du site est inchangé. Sécurité : {@code brandName} échappé HTML (audit #4).
     */
    private GeneratedSite ensureHomeHero(GeneratedSite site, String brandName) {
        List<GeneratedPage> pages = new ArrayList<>(site.pages().size());
        for (GeneratedPage p : site.pages()) {
            pages.add(p.type() == com.clenzy.booking.model.SitePageType.HOME
                ? new GeneratedPage(p.path(), p.type(), p.title(),
                    injectHomeHero(p.html(), brandName), p.seoTitle(), p.seoDescription())
                : p);
        }
        return new GeneratedSite(site.css(), pages, site.designVars());
    }

    /** Insère un hero (titre marque + accroche + CTA) après la nav si la page n'a aucun {@code <h1>} ; sinon inchangé. */
    private String injectHomeHero(String html, String brandName) {
        if (html == null || html.toLowerCase(Locale.ROOT).contains("<h1")) {
            return html;
        }
        String hero = "<section class=\"site-hero\">"
            + "<h1>" + com.clenzy.util.StringUtils.escapeHtml(brandName) + "</h1>"
            + "<p>Réservez votre séjour en direct, au meilleur prix.</p>"
            + "<a class=\"site-btn\" href=\"/logements\">Voir les logements</a>"
            + "</section>";
        final String navClose = "</nav>";
        int navEnd = html.toLowerCase(Locale.ROOT).indexOf(navClose);
        if (navEnd >= 0) {
            int after = navEnd + navClose.length();
            return html.substring(0, after) + hero + html.substring(after);
        }
        return hero + html;
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

    /**
     * Isole l'objet JSON de la réponse : retire un éventuel bloc ```json … ``` puis borne au premier objet
     * {@code { … }} (du 1er '{' au dernier '}'). Tolère ainsi un préambule/épilogue éventuel du LLM (ex.
     * « Voici le JSON : … ») — robustesse nécessaire car Anthropic n'a pas de mode JSON strict.
     */
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

    // ─── Types internes (parsing) ───────────────────────────────────────────────

    private record GeneratedSite(String css, List<GeneratedPage> pages, java.util.Map<String, String> designVars) {}

    private record GeneratedPage(
        String path,
        com.clenzy.booking.model.SitePageType type,
        String title,
        String html,
        String seoTitle,
        String seoDescription) {}
}
