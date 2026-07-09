package com.clenzy.booking.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Validateur serveur du contrat d'authoring des templates de booking engine (cf. {@code DESIGN-BAITLY.md},
 * phase P1). Miroir du garde-fou d'authoring {@code scripts/validate-baitly-template.mjs} : refuse à
 * l'ingestion tout template non conforme AVANT persistance au catalogue.
 *
 * <p>Format d'authoring attendu : {@code { meta, designVars, css, pages:[{path,type,title,html,seoTitle,
 * seoDescription}] }}. Ce validateur applique la checklist §10 du contrat (types de page, vocabulaire des
 * marqueurs {@code data-clenzy-widget}, présence exhaustive des tokens {@code --bt-*}, sécurité HTML, fonds
 * image non-inline, longueurs SEO). Il NE remplace PAS le sanitizer serveur ({@code EmailHtmlSanitizer}),
 * qui reste appliqué au rendu — il complète en amont pour rejeter tôt un contenu malformé.</p>
 */
@Component
public class SiteTemplateContractValidator {

    private static final Set<String> PAGE_TYPES = Set.of("HOME", "PROPERTY_LIST", "PROPERTY_DETAIL", "BLOG", "CUSTOM");

    /** Vocabulaire « parcours » autorisé sur data-clenzy-widget (PAS les ids de blocs Studio booking-*). */
    private static final Set<String> WIDGET_MARKERS = Set.of(
        "search", "results", "property-list", "property", "dates", "availability", "guests",
        "currency", "cart", "price", "guest-form", "checkout", "account", "confirmation", "upsells");

    /** Tokens --bt-* qui DOIVENT être posés (§4 du contrat). */
    private static final List<String> REQUIRED_TOKENS = List.of(
        "--bt-color-primary", "--bt-color-primary-hover", "--bt-color-on-primary", "--bt-color-accent",
        "--bt-color-bg", "--bt-color-surface", "--bt-color-surface-2",
        "--bt-color-text", "--bt-color-text-muted", "--bt-color-border", "--bt-color-divider",
        "--bt-font-heading", "--bt-font-body",
        "--bt-text-xs", "--bt-text-sm", "--bt-text-md", "--bt-text-lg", "--bt-text-xl", "--bt-text-2xl", "--bt-text-3xl",
        "--bt-weight-normal", "--bt-weight-medium", "--bt-weight-semibold", "--bt-weight-bold", "--bt-heading-weight",
        "--bt-leading-tight", "--bt-leading-normal", "--bt-leading-relaxed",
        "--bt-tracking-tight", "--bt-tracking-normal", "--bt-tracking-wide",
        "--bt-space-1", "--bt-space-2", "--bt-space-3", "--bt-space-4", "--bt-space-5", "--bt-space-6",
        "--bt-section-y", "--bt-container",
        "--bt-radius-sm", "--bt-radius-md", "--bt-radius-lg", "--bt-radius-pill",
        "--bt-radius-button", "--bt-radius-card", "--bt-radius-input",
        "--bt-shadow-sm", "--bt-shadow-md", "--bt-shadow-lg", "--bt-shadow-card", "--bt-border-width",
        "--bt-button-padding-x", "--bt-button-padding-y", "--bt-button-transform", "--bt-control-height",
        "--bt-duration", "--bt-ease");

    private static final Pattern SLUG = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final Pattern SITE_ROOT = Pattern.compile("class\\s*=\\s*[\"'][^\"']*\\bsite-root\\b");
    private static final Pattern SITE_NAV = Pattern.compile("class\\s*=\\s*[\"'][^\"']*\\bsite-nav\\b");
    private static final Pattern SITE_FOOTER = Pattern.compile("class\\s*=\\s*[\"'][^\"']*\\bsite-footer\\b");
    private static final Pattern SCRIPT = Pattern.compile("<script[\\s>]", Pattern.CASE_INSENSITIVE);
    private static final Pattern IFRAME = Pattern.compile("<iframe[\\s>]", Pattern.CASE_INSENSITIVE);
    private static final Pattern EVENT_ATTR = Pattern.compile("\\son[a-z]+\\s*=", Pattern.CASE_INSENSITIVE);
    private static final Pattern INLINE_BG = Pattern.compile(
        "style\\s*=\\s*[\"'][^\"']*background(-image)?\\s*:[^\"']*url\\(", Pattern.CASE_INSENSITIVE);
    private static final Pattern WIDGET_MARKER = Pattern.compile(
        "data-clenzy-widget\\s*=\\s*[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern NON_EMPTY_MARKER = Pattern.compile(
        "<div\\b[^>]*data-clenzy-widget\\s*=\\s*[\"'][^\"']+[\"'][^>]*>([\\s\\S]*?)</div>", Pattern.CASE_INSENSITIVE);

    /** Valide le template d'authoring. Retourne la liste des erreurs (vide = conforme). */
    public List<String> validate(JsonNode tpl) {
        List<String> errors = new ArrayList<>();
        if (tpl == null || !tpl.isObject()) {
            errors.add("payload d'authoring absent ou non-objet");
            return errors;
        }

        JsonNode meta = tpl.path("meta");
        if (!meta.isObject()) errors.add("meta manquant");
        if (blank(meta.path("name").asText(null))) errors.add("meta.name manquant");
        String slug = meta.path("slug").asText(null);
        if (blank(slug) || !SLUG.matcher(slug).matches()) errors.add("meta.slug absent ou non kebab-case");
        if (blank(meta.path("category").asText(null))) errors.add("meta.category manquant");
        if (blank(meta.path("archetype").asText(null))) errors.add("meta.archetype manquant");
        if (blank(meta.path("theme").asText(null))) errors.add("meta.theme manquant");

        JsonNode designVars = tpl.path("designVars");
        String css = tpl.path("css").asText("");
        if (!designVars.isObject()) errors.add("designVars manquant");
        if (blank(css)) errors.add("css partagé manquant ou vide");
        for (String tok : REQUIRED_TOKENS) {
            if (!designVars.has(tok)) errors.add("designVars: token manquant " + tok);
            if (!css.isEmpty() && !css.contains(tok)) errors.add("css: token non utilisé/posé " + tok);
        }

        JsonNode pages = tpl.path("pages");
        if (!pages.isArray() || pages.isEmpty()) {
            errors.add("pages[] vide");
            return errors;
        }
        Set<String> paths = new java.util.HashSet<>();
        for (JsonNode p : pages) {
            String path = p.path("path").asText(null);
            if (path != null) paths.add(path);
        }
        boolean hasHome = false;
        int i = 0;
        for (JsonNode p : pages) {
            String tag = "page[" + i++ + "] (" + p.path("path").asText("?") + ")";
            String path = p.path("path").asText(null);
            String type = p.path("type").asText(null);
            if (blank(path) || !path.startsWith("/")) errors.add(tag + ": path absent ou ne commence pas par /");
            if (type == null || !PAGE_TYPES.contains(type)) errors.add(tag + ": type invalide « " + type + " »");
            if ("HOME".equals(type)) hasHome = true;
            if (blank(p.path("title").asText(null))) errors.add(tag + ": title manquant");
            String seoTitle = p.path("seoTitle").asText(null);
            String seoDesc = p.path("seoDescription").asText(null);
            if (blank(seoTitle) || seoTitle.length() > 60) errors.add(tag + ": seoTitle absent ou > 60 car.");
            if (blank(seoDesc) || seoDesc.length() > 155) errors.add(tag + ": seoDescription absent ou > 155 car.");

            String html = p.path("html").asText("");
            if (blank(html)) { errors.add(tag + ": html vide"); continue; }

            long roots = SITE_ROOT.matcher(html).results().count();
            if (roots != 1) errors.add(tag + ": doit contenir exactement une .site-root (trouvé " + roots + ")");
            if (!SITE_NAV.matcher(html).find()) errors.add(tag + ": <nav class=\"site-nav\"> manquant");
            if (!SITE_FOOTER.matcher(html).find()) errors.add(tag + ": <footer class=\"site-footer\"> manquant");
            if (SCRIPT.matcher(html).find()) errors.add(tag + ": <script> interdit");
            if (IFRAME.matcher(html).find()) errors.add(tag + ": <iframe> interdit");
            if (EVENT_ATTR.matcher(html).find()) errors.add(tag + ": attribut d'événement inline (on*=) interdit");
            if (INLINE_BG.matcher(html).find()) errors.add(tag + ": fond image inline interdit (utiliser une classe CSS)");

            var mm = WIDGET_MARKER.matcher(html);
            while (mm.find()) {
                if (!WIDGET_MARKERS.contains(mm.group(1))) {
                    errors.add(tag + ": marqueur inconnu data-clenzy-widget=\"" + mm.group(1) + "\" (hors vocabulaire parcours)");
                }
            }
            var em = NON_EMPTY_MARKER.matcher(html);
            while (em.find()) {
                if (!em.group(1).trim().isEmpty()) {
                    errors.add(tag + ": un marqueur widget doit être un <div> VIDE");
                }
            }
        }
        if (!hasHome) errors.add("aucune page de type HOME");
        return errors;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
