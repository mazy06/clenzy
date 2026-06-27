package com.clenzy.booking.service;

import com.clenzy.booking.dto.AutoTranslateResultDto;
import com.clenzy.booking.dto.BlogPostDto;
import com.clenzy.booking.dto.SitePageDto;
import com.clenzy.booking.model.BlogPost;
import com.clenzy.booking.model.Site;
import com.clenzy.booking.model.SitePage;
import com.clenzy.booking.model.SiteStatus;
import com.clenzy.booking.repository.BlogPostRepository;
import com.clenzy.booking.repository.SitePageRepository;
import com.clenzy.booking.repository.SiteRepository;
import com.clenzy.exception.ContentTranslationException;
import com.clenzy.exception.NotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Auto-traduction IA du contenu de site (P1 booking engine multi-langue) : pour une page ou un article
 * SOURCE, produit les variantes localisées manquantes (fr/en/ar) EN BROUILLON pour relecture humaine —
 * jamais publiées automatiquement (même garde-fou que le blog IA, 2.13).
 *
 * <p>Réutilise la brique de traduction {@code translate-html} ({@link SiteContentAiService} :
 * {@code translateHtmlMarkup} préserve le markup, {@code translateTextFields} pour les champs courts).
 * Aucun appel LLM dans une transaction DB (audit règle #2) : on charge la source + ownership en lecture
 * courte, on traduit HORS transaction, puis on persiste chaque brouillon dans une transaction courte
 * via {@link ObjectProvider} (pas d'auto-invocation @Transactional, audit règle #6). Un échec de
 * traduction lève {@link ContentTranslationException} — jamais avalé (audit règle #7).</p>
 *
 * <p>RTL ({@code ar}) : le markup traduit n'est pas réécrit (la direction reste gérée au rendu SSR).</p>
 */
@Service
public class ContentTranslationService {

    private static final Set<String> SUPPORTED_LOCALES = Set.of("fr", "en", "ar");
    /** Clés de props non rédactionnelles (URLs, couleurs…) — alignées sur {@code SiteContentAiService}. */
    private static final Set<String> SKIP_KEY_HINTS = Set.of("url", "image", "color", "bg", "icon");

    private final SiteRepository siteRepository;
    private final SitePageRepository pageRepository;
    private final BlogPostRepository blogPostRepository;
    private final SiteContentAiService translator;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<ContentTranslationService> self;

    public ContentTranslationService(SiteRepository siteRepository,
                                     SitePageRepository pageRepository,
                                     BlogPostRepository blogPostRepository,
                                     SiteContentAiService translator,
                                     ObjectMapper objectMapper,
                                     ObjectProvider<ContentTranslationService> self) {
        this.siteRepository = siteRepository;
        this.pageRepository = pageRepository;
        this.blogPostRepository = blogPostRepository;
        this.translator = translator;
        this.objectMapper = objectMapper;
        this.self = self;
    }

    // ─── Pages ────────────────────────────────────────────────────────────────

    /**
     * Auto-traduit une page vers les {@code targets} demandées. Chaque variante est créée EN BROUILLON
     * ({@code DRAFT}, {@code aiGenerated=true}, {@code reviewedAt=null}). Locale source et variantes déjà
     * existantes sont ignorées (renvoyées dans {@code skippedLocales}).
     */
    public AutoTranslateResultDto autoTranslatePage(Long orgId, Long siteId, Long pageId, List<String> targets) {
        // 1) Chargement + ownership en lecture courte (hors LLM).
        PageSource src = self.getObject().loadPageSource(orgId, siteId, pageId);

        List<SitePageDto> created = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        for (String target : normalizeTargets(targets, src.sourceLocale())) {
            if (pageVariantExists(siteId, src.path(), target)) {
                skipped.add(target);
                continue;
            }
            // 2) Traduction HORS transaction.
            String title = translateField(orgId, src.title(), target);
            String seoTitle = translateField(orgId, src.seoTitle(), target);
            String seoDescription = translateField(orgId, src.seoDescription(), target);
            String blocks = translateBlocks(orgId, src.blocks(), target);
            // 3) Persistance du brouillon en transaction courte.
            SitePage saved = self.getObject().persistPageDraft(
                siteId, src, target, title, seoTitle, seoDescription, blocks);
            created.add(SitePageDto.from(saved));
        }
        return AutoTranslateResultDto.forPages(created, skipped);
    }

    @Transactional(readOnly = true)
    public PageSource loadPageSource(Long orgId, Long siteId, Long pageId) {
        Site site = requireOwnedSite(orgId, siteId);
        SitePage page = pageRepository.findByIdAndSiteId(pageId, siteId)
            .orElseThrow(() -> new NotFoundException("Page introuvable: " + pageId));
        String sourceLocale = page.getLocale() != null ? page.getLocale() : site.getDefaultLocale();
        return new PageSource(page.getPath(), page.getType(), sourceLocale, page.getTitle(),
            page.getBlocks(), page.getSeoTitle(), page.getSeoDescription(), page.getSeoOgImageUrl(),
            page.getSortOrder());
    }

    @Transactional
    public SitePage persistPageDraft(Long siteId, PageSource src, String target,
                                     String title, String seoTitle, String seoDescription, String blocks) {
        SitePage variant = new SitePage();
        variant.setSiteId(siteId);
        variant.setPath(src.path());
        variant.setType(src.type());
        variant.setLocale(target);
        variant.setTitle(title);
        variant.setBlocks(blocks);
        variant.setSeoTitle(seoTitle);
        variant.setSeoDescription(seoDescription);
        variant.setSeoOgImageUrl(src.seoOgImageUrl()); // média non traduit
        variant.setSortOrder(src.sortOrder());
        variant.setStatus(SiteStatus.DRAFT);      // jamais publié automatiquement
        variant.setAiGenerated(true);
        variant.setReviewedAt(null);
        return pageRepository.save(variant);
    }

    // ─── Articles de blog ───────────────────────────────────────────────────────

    /**
     * Auto-traduit un article vers les {@code targets}. Corps ({@code body}, markdown/HTML) traduit via
     * la brique markup-preserving ; {@code title}/{@code excerpt}/SEO via champs courts. Variante créée
     * EN BROUILLON pour relecture (jamais PUBLISHED directement).
     */
    public AutoTranslateResultDto autoTranslatePost(Long orgId, Long siteId, Long postId, List<String> targets) {
        PostSource src = self.getObject().loadPostSource(orgId, siteId, postId);

        List<BlogPostDto> created = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        for (String target : normalizeTargets(targets, src.sourceLocale())) {
            if (postVariantExists(siteId, src.slug(), target)) {
                skipped.add(target);
                continue;
            }
            String title = translateField(orgId, src.title(), target);
            String excerpt = translateField(orgId, src.excerpt(), target);
            String seoTitle = translateField(orgId, src.seoTitle(), target);
            String seoDescription = translateField(orgId, src.seoDescription(), target);
            String body = src.body() == null || src.body().isBlank()
                ? src.body()
                : translator.translateHtmlMarkup(orgId, src.body(), target);
            BlogPost saved = self.getObject().persistPostDraft(
                orgId, siteId, src, target, title, excerpt, body, seoTitle, seoDescription);
            created.add(BlogPostDto.from(saved));
        }
        return AutoTranslateResultDto.forPosts(created, skipped);
    }

    @Transactional(readOnly = true)
    public PostSource loadPostSource(Long orgId, Long siteId, Long postId) {
        Site site = requireOwnedSite(orgId, siteId);
        BlogPost post = blogPostRepository.findByIdAndSiteId(postId, siteId)
            .orElseThrow(() -> new NotFoundException("Article introuvable: " + postId));
        String sourceLocale = post.getLocale() != null ? post.getLocale() : site.getDefaultLocale();
        return new PostSource(post.getSlug(), sourceLocale, post.getTitle(), post.getExcerpt(),
            post.getBody(), post.getCoverImageUrl(), post.getTags(), post.getSeoTitle(),
            post.getSeoDescription(), post.getSeoOgImageUrl());
    }

    @Transactional
    public BlogPost persistPostDraft(Long orgId, Long siteId, PostSource src, String target, String title,
                                     String excerpt, String body, String seoTitle, String seoDescription) {
        BlogPost variant = new BlogPost();
        variant.setSiteId(siteId);
        variant.setOrganizationId(orgId);
        variant.setSlug(src.slug());
        variant.setLocale(target);
        variant.setTitle(title);
        variant.setExcerpt(excerpt);
        variant.setBody(body);
        variant.setCoverImageUrl(src.coverImageUrl()); // média non traduit
        variant.setTags(src.tags());
        variant.setSeoTitle(seoTitle);
        variant.setSeoDescription(seoDescription);
        variant.setSeoOgImageUrl(src.seoOgImageUrl());
        variant.setStatus(SiteStatus.DRAFT);     // jamais publié automatiquement
        variant.setAiGenerated(true);
        variant.setReviewedAt(null);
        return blogPostRepository.save(variant);
    }

    // ─── Traduction (réutilise SiteContentAiService) ──────────────────────────────

    /**
     * Traduit un champ texte court (titre, meta) via la brique partagée. {@code null}/vide inchangé.
     * Échec IA → {@link ContentTranslationException} (jamais avalé, audit #7).
     */
    private String translateField(Long orgId, String value, String target) {
        if (value == null || value.isBlank()) return value;
        List<String> out = translator.translateTextFields(orgId, List.of(value), target);
        if (out == null || out.size() != 1) {
            throw new ContentTranslationException("Échec de la traduction IA vers " + target);
        }
        return out.get(0);
    }

    /**
     * Traduit le TEXTE des blocs (JSON du builder) vers {@code target} en préservant la structure : on
     * collecte les valeurs de props rédactionnelles (mêmes règles que {@code SiteContentAiService}), on
     * les traduit en UN appel, puis on les réinjecte aux mêmes emplacements. Échec → exception explicite.
     */
    private String translateBlocks(Long orgId, String blocksJson, String target) {
        if (blocksJson == null || blocksJson.isBlank()) return blocksJson;
        final JsonNode root;
        try {
            root = objectMapper.readTree(blocksJson);
        } catch (Exception e) {
            // Blocs illisibles : on ne devine pas la structure → on garde l'original (pas de corruption).
            return blocksJson;
        }
        if (!root.isArray()) return blocksJson;

        final List<ObjectNode> targetProps = new ArrayList<>();
        final List<String> keys = new ArrayList<>();
        final List<String> values = new ArrayList<>();
        for (JsonNode block : root) {
            JsonNode props = block.path("props");
            if (!props.isObject()) continue;
            ObjectNode po = (ObjectNode) props;
            po.fieldNames().forEachRemaining(key -> {
                JsonNode v = po.get(key);
                if (v == null || !v.isTextual()) return;
                String keyLower = key.toLowerCase(Locale.ROOT);
                if (SKIP_KEY_HINTS.stream().anyMatch(keyLower::contains)) return;
                String text = v.asText().trim();
                if (text.isEmpty() || text.startsWith("http") || text.startsWith("#") || text.length() > 600) return;
                targetProps.add(po);
                keys.add(key);
                values.add(text);
            });
        }
        if (values.isEmpty()) return blocksJson;

        List<String> translated = translator.translateTextFields(orgId, values, target);
        if (translated == null || translated.size() != values.size()) {
            throw new ContentTranslationException("Échec de la traduction IA des blocs vers " + target);
        }
        for (int i = 0; i < targetProps.size(); i++) {
            targetProps.get(i).put(keys.get(i), translated.get(i));
        }
        return ((ArrayNode) root).toString();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    private Site requireOwnedSite(Long orgId, Long siteId) {
        return siteRepository.findByIdAndOrganizationId(siteId, orgId)
            .orElseThrow(() -> new NotFoundException("Site introuvable: " + siteId));
    }

    private boolean pageVariantExists(Long siteId, String path, String locale) {
        return pageRepository.findBySiteIdAndPathAndLocale(siteId, path, locale).isPresent();
    }

    private boolean postVariantExists(Long siteId, String slug, String locale) {
        return blogPostRepository.findBySiteIdAndSlugAndLocale(siteId, slug, locale).isPresent();
    }

    /** Locales cibles supportées (fr/en/ar), distinctes, hors locale source. Lève si aucune cible valide. */
    private List<String> normalizeTargets(List<String> targets, String sourceLocale) {
        if (targets == null || targets.isEmpty()) {
            throw new IllegalArgumentException("Aucune langue cible fournie");
        }
        String src = sourceLocale != null ? sourceLocale.trim().toLowerCase(Locale.ROOT) : "fr";
        Set<String> out = new LinkedHashSet<>();
        for (String t : targets) {
            if (t == null) continue;
            String norm = t.trim().toLowerCase(Locale.ROOT);
            if (SUPPORTED_LOCALES.contains(norm) && !norm.equals(src)) {
                out.add(norm);
            }
        }
        if (out.isEmpty()) {
            throw new IllegalArgumentException("Aucune langue cible valide (fr/en/ar, hors langue source)");
        }
        return List.copyOf(out);
    }

    /** Snapshot immuable de la page source (lu en tx courte ; utilisé hors-tx pour la traduction). */
    public record PageSource(String path, com.clenzy.booking.model.SitePageType type, String sourceLocale,
                             String title, String blocks, String seoTitle, String seoDescription,
                             String seoOgImageUrl, int sortOrder) {}

    /** Snapshot immuable de l'article source. */
    public record PostSource(String slug, String sourceLocale, String title, String excerpt, String body,
                             String coverImageUrl, String tags, String seoTitle, String seoDescription,
                             String seoOgImageUrl) {}
}
