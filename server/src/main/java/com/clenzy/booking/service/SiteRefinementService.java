package com.clenzy.booking.service;

import com.clenzy.booking.dto.SitePageDto;
import com.clenzy.booking.model.DesignSystem;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SitePage;
import com.clenzy.booking.repository.DesignSystemRepository;
import com.clenzy.booking.repository.SitePageRepository;
import com.clenzy.booking.repository.SiteRepository;
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
import com.clenzy.util.EmailHtmlSanitizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/**
 * Retouche IA d'une page de site en langage naturel (« Retoucher avec l'IA », phase P3). Le user décrit un
 * ajustement (« rends le hero plus chaleureux », « passe la liste en 2 colonnes ») → un appel LLM régénère
 * le HTML de la page en préservant la structure ({@code .site-root}), les marqueurs {@code data-clenzy-widget}
 * (vides), et le contrat de tokens {@code --bt-*}. Résultat ré-assaini puis persisté dans l'enveloppe GrapesJS.
 *
 * <p>Calqué sur {@link SiteGenerationService} : appel LLM HORS transaction (audit #2) ; ownership org en
 * lecture courte (#3) ; feature {@code DESIGN} gatée + budget ; échec explicite (#7) ; contrôleur mince (#4).
 * Garde-fou : si la sortie LLM ne contient pas de {@code .site-root}, on conserve le HTML d'origine.</p>
 *
 * <p>P4 (mémoire de design) — lecture : les design tokens du site sont injectés dans le prompt pour que la
 * retouche reste cohérente avec la marque. L'accumulation (write) des préférences est un chantier ultérieur.</p>
 */
@Service
public class SiteRefinementService {

    private static final Logger log = LoggerFactory.getLogger(SiteRefinementService.class);

    private static final String PROVIDER = "anthropic";
    private static final String GRAPES_FORMAT = "grapesjs";
    private static final int MAX_TOKENS_REFINE = 8000;

    private static final String SYSTEM_PROMPT = """
        Tu retouches UNE page d'un site vitrine de réservation (location courte durée), éditée dans un studio
        no-code GrapesJS. On te donne le HTML actuel de la page et une INSTRUCTION de modification. Applique
        UNIQUEMENT cette instruction, en préservant scrupuleusement :
        - la racine unique <div class="site-root"> et la structure de classes site-* (site-wrap, site-section,
          site-hero, site-nav, site-footer, site-btn…) ;
        - TOUS les marqueurs <div data-clenzy-widget="..."></div> — ils restent VIDES et à leur place logique ;
        - l'usage des variables CSS --bt-* (n'écris jamais une couleur/taille en dur si un token existe) ;
        - la langue et le sens du contenu existant (ne réécris pas ce que l'instruction ne demande pas).
        Sécurité : aucun <script>, aucun <iframe>, aucun attribut d'événement (onclick…), images en https absolu,
        aucun fond image en style inline (utilise des classes CSS).
        Réponds UNIQUEMENT par un objet JSON strict, sans texte autour : {"html":"<div class=\\"site-root\\">…</div>"}.
        """;

    private final SiteRepository siteRepository;
    private final SitePageRepository pageRepository;
    private final DesignSystemRepository designSystemRepository;
    private final AiProviderRouter aiProviderRouter;
    private final AiTokenBudgetService tokenBudgetService;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<SiteRefinementService> self;

    public SiteRefinementService(SiteRepository siteRepository,
                                 SitePageRepository pageRepository,
                                 DesignSystemRepository designSystemRepository,
                                 AiProviderRouter aiProviderRouter,
                                 AiTokenBudgetService tokenBudgetService,
                                 NotificationService notificationService,
                                 ObjectMapper objectMapper,
                                 ObjectProvider<SiteRefinementService> self) {
        this.siteRepository = siteRepository;
        this.pageRepository = pageRepository;
        this.designSystemRepository = designSystemRepository;
        this.aiProviderRouter = aiProviderRouter;
        this.tokenBudgetService = tokenBudgetService;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
        this.self = self;
    }

    /**
     * Retouche la page {@code pageId} du site {@code siteId} selon {@code instruction}.
     *
     * @return la page mise à jour (statut inchangé — reste DRAFT tant qu'on ne republie pas).
     * @throws NotFoundException        si le site/la page n'appartient pas à l'org.
     * @throws IllegalArgumentException si l'instruction est vide.
     * @throws AiNotConfiguredException si aucun modèle IA n'est exploitable.
     * @throws SiteGenerationException  si l'appel/parsing LLM échoue.
     */
    public SitePageDto refine(Long orgId, Long siteId, Long pageId, String instruction) {
        if (instruction == null || instruction.isBlank()) {
            throw new IllegalArgumentException("Instruction de retouche requise.");
        }
        // 1. Ownership + données en lecture courte (audit #3) — pas de tx ouverte pendant le LLM.
        Site site = siteRepository.findByIdAndOrganizationId(siteId, orgId)
            .orElseThrow(() -> new NotFoundException("Site introuvable: " + siteId));
        SitePage page = pageRepository.findByIdAndSiteId(pageId, siteId)
            .orElseThrow(() -> new NotFoundException("Page introuvable: " + pageId));

        final String envelope = page.getBlocks();
        final String currentHtml = extractHtml(envelope);
        final String currentCss = extractCss(envelope);
        if (currentHtml == null || currentHtml.isBlank()) {
            throw new IllegalArgumentException("La page n'a pas de contenu HTML à retoucher.");
        }

        // 2. Gating + budget (feature DESIGN, même résolution que la génération de site).
        tokenBudgetService.requireFeatureEnabled(orgId, AiFeature.DESIGN);
        final ResolvedTarget key;
        try {
            key = aiProviderRouter.resolveKey(orgId, PROVIDER, AiFeature.DESIGN);
        } catch (AiNotConfiguredException e) {
            notifyNoUsableModel();
            throw e;
        }
        tokenBudgetService.requireBudget(orgId, AiFeature.DESIGN, key.source());

        // 3. Appel LLM HORS transaction (audit #2). Direction = système de design du site (prose + tokens)
        //    si présent, sinon repli sur les design tokens bruts du site.
        String newHtml = callLlm(orgId, currentHtml, instruction, buildDesignContext(site));
        // Garde-fou : sortie inexploitable → on conserve l'existant (aucune régression).
        if (newHtml == null || !newHtml.toLowerCase(Locale.ROOT).contains("site-root")) {
            log.warn("Retouche IA sans .site-root exploitable (org={} site={} page={}) — HTML conservé.",
                orgId, siteId, pageId);
            return SitePageDto.from(page);
        }
        String sanitized = EmailHtmlSanitizer.sanitize(newHtml);

        // 4. Persistance (transaction courte via le proxy self).
        return self.getObject().persistRefinedPage(siteId, pageId, wrapGrapesEnvelope(sanitized, currentCss));
    }

    /** Écrit la nouvelle enveloppe dans la page (transaction courte, hors appel LLM). */
    @Transactional
    public SitePageDto persistRefinedPage(Long siteId, Long pageId, String envelope) {
        SitePage page = pageRepository.findByIdAndSiteId(pageId, siteId)
            .orElseThrow(() -> new NotFoundException("Page introuvable: " + pageId));
        page.setBlocks(envelope);
        return SitePageDto.from(pageRepository.save(page));
    }

    /**
     * Contexte de direction pour la retouche : la prose {@code DESIGN.md} + les tokens du système de design
     * du site s'il en a un (visible de son org ou global), sinon repli sur ses design tokens bruts.
     */
    private String buildDesignContext(Site site) {
        if (site.getDesignSystemId() != null) {
            DesignSystem ds = designSystemRepository.findById(site.getDesignSystemId())
                .filter(d -> d.getOrganizationId() == null
                    || d.getOrganizationId().equals(site.getOrganizationId()))
                .orElse(null);
            if (ds != null) {
                StringBuilder sb = new StringBuilder();
                if (ds.getDesignMarkdown() != null && !ds.getDesignMarkdown().isBlank()) {
                    sb.append(ds.getDesignMarkdown().trim());
                }
                if (ds.getTokensJson() != null && !ds.getTokensJson().isBlank()) {
                    sb.append("\n\nTokens --bt-* : ").append(ds.getTokensJson());
                }
                if (sb.length() > 0) {
                    return sb.toString();
                }
            }
        }
        String tokens = site.getDesignTokens();
        return (tokens != null && !tokens.isBlank()) ? "Tokens de la marque : " + tokens : null;
    }

    // ─── LLM ────────────────────────────────────────────────────────────────

    private String callLlm(Long orgId, String currentHtml, String instruction, String designContext) {
        StringBuilder user = new StringBuilder();
        user.append("INSTRUCTION DE RETOUCHE :\n").append(instruction.trim()).append("\n\n");
        if (designContext != null && !designContext.isBlank()) {
            // DS-3 : ancre la retouche sur la DIRECTION de design du site (prose DESIGN.md + tokens).
            user.append("── DIRECTION DE DESIGN À RESPECTER ──\n").append(designContext).append("\n\n");
        }
        user.append("HTML ACTUEL DE LA PAGE :\n").append(currentHtml);

        AiRequest request = AiRequest.jsonWithMaxTokens(SYSTEM_PROMPT, user.toString(), MAX_TOKENS_REFINE);
        final RoutedResponse routed;
        try {
            routed = aiProviderRouter.route(orgId, PROVIDER, AiFeature.DESIGN, request);
        } catch (RuntimeException e) {
            throw new SiteGenerationException("Échec de l'appel IA pour la retouche de page", e);
        }
        tokenBudgetService.recordUsage(orgId, AiFeature.DESIGN, routed.providerName(), routed.response());

        String content = routed.response() != null ? routed.response().content() : null;
        return parseHtml(content);
    }

    /** Extrait le champ {@code html} de la réponse JSON {@code {"html":"…"}}. */
    private String parseHtml(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new SiteGenerationException("Réponse IA vide");
        }
        try {
            JsonNode root = objectMapper.readTree(stripFences(raw));
            JsonNode html = root.get("html");
            if (html != null && html.isTextual() && !html.asText().isBlank()) {
                return html.asText();
            }
        } catch (Exception e) {
            throw new SiteGenerationException("Réponse IA illisible (JSON {html} attendu)", e);
        }
        throw new SiteGenerationException("Réponse IA sans champ html exploitable");
    }

    // ─── Enveloppe GrapesJS ───────────────────────────────────────────────────

    private String extractHtml(String blocks) {
        return envelopeField(blocks, "html", blocks); // repli : blocks brut = HTML legacy
    }

    private String extractCss(String blocks) {
        return envelopeField(blocks, "css", "");
    }

    /** Lit un champ de l'enveloppe GrapesJS ; repli sur {@code fallback} si {@code blocks} n'est pas un objet JSON. */
    private String envelopeField(String blocks, String field, String fallback) {
        if (blocks == null || blocks.isBlank() || blocks.charAt(0) != '{') {
            return fallback;
        }
        try {
            JsonNode node = objectMapper.readTree(blocks);
            JsonNode v = node.get(field);
            return v != null && v.isTextual() ? v.asText() : fallback;
        } catch (Exception e) {
            return fallback;
        }
    }

    private String wrapGrapesEnvelope(String html, String css) {
        var node = objectMapper.createObjectNode();
        node.put("format", GRAPES_FORMAT);
        node.put("html", html != null ? html : "");
        node.put("css", css != null ? css : "");
        node.putNull("projectData");
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            throw new SiteGenerationException("Échec de sérialisation de l'enveloppe GrapesJS", e);
        }
    }

    private void notifyNoUsableModel() {
        notificationService.notifyAllPlatformStaff(
            NotificationKey.AI_MODEL_EOL,
            "Retouche de site IA indisponible",
            "Aucun modèle IA exploitable pour la retouche de page : le modèle assigné à « Design IA » est "
                + "indisponible ou absent, et aucune clé de secours n'est configurée. Vérifiez la configuration IA.",
            "/settings?tab=ai");
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
