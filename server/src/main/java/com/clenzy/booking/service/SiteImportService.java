package com.clenzy.booking.service;

import com.clenzy.booking.dto.SiteImportResultDto;
import com.clenzy.util.EmailHtmlSanitizer;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Import d'une page/template externe par URL pour alimenter l'éditeur GrapesJS
 * du Studio (G3) : récupère le HTML + CSS + assets référencés et renvoie un
 * {@link SiteImportResultDto} (jamais une entité JPA).
 *
 * <p><b>Garde-fous SSRF</b> — tous les fetchs réseau passent par
 * {@link PinnedSiteFetcher} (le primitif durci déjà utilisé par la preview de
 * sites) : HTTPS port 443 uniquement, DNS résolu une seule fois puis connexion
 * TCP épinglée sur l'IP validée (anti DNS-rebinding/TOCTOU), redirections NON
 * suivies (toute réponse non-200 rejetée → pas de rebond vers une cible
 * interne), taille de réponse bornée. Aucune re-résolution DNS via
 * {@code Jsoup.connect} : Jsoup ne sert qu'au <em>parsing</em> de bytes déjà
 * téléchargés, jamais à télécharger.</p>
 *
 * <p><b>Assainissement HTML</b> — le corps renvoyé passe par
 * {@link EmailHtmlSanitizer#sanitize} (suppression de
 * {@code script/iframe/object/embed/frame/base/form}, des handlers {@code on*=}
 * et des schemes {@code javascript:}/{@code data:}/{@code vbscript:} obfusqués
 * inclus). GrapesJS reçoit donc un HTML neutralisé.</p>
 *
 * <p>Le contrôle d'org/ownership est assuré en amont par le controller (le site
 * cible doit appartenir à l'organisation de l'appelant).</p>
 */
@Service
public class SiteImportService {

    private static final Logger log = LoggerFactory.getLogger(SiteImportService.class);

    /** Taille max de la page HTML importée (5 MB). */
    private static final long MAX_PAGE_BYTES = 5 * 1024 * 1024;

    /** Taille max d'une feuille de style liée (500 KB). */
    private static final long MAX_STYLESHEET_BYTES = 500 * 1024;

    /** Nombre max de feuilles de style liées re-téléchargées (limite la surface réseau). */
    private static final int MAX_LINKED_STYLESHEETS = 10;

    /** Nombre max d'URLs d'assets remontées (évite un DTO pléthorique). */
    private static final int MAX_ASSETS = 200;

    private final PinnedSiteFetcher siteFetcher;

    public SiteImportService(PinnedSiteFetcher siteFetcher) {
        this.siteFetcher = siteFetcher;
    }

    /**
     * Récupère et assainit la page située à {@code url}.
     *
     * @param url URL HTTPS de la page/template à importer (validée SSRF par le fetcher épinglé)
     * @return HTML assaini + CSS agrégé + liste d'assets absolus
     * @throws IllegalArgumentException si l'URL est invalide ou interdite (SSRF)
     * @throws IOException              si la page ne peut être récupérée
     */
    public SiteImportResultDto importFromUrl(String url) throws IOException {
        // PinnedSiteFetcher.fetch re-valide l'URL (SSRF) et se connecte sur l'IP épinglée.
        PinnedSiteFetcher.FetchedResource page = siteFetcher.fetch(url, MAX_PAGE_BYTES);
        String rawHtml = new String(page.body(), StandardCharsets.UTF_8);

        // baseUri = url d'origine → Jsoup résout les liens relatifs en absolus (absUrl).
        Document doc = Jsoup.parse(rawHtml, url);

        // Scripts retirés avant tout : preview statique, pas d'exécution JS dans l'éditeur.
        doc.select("script").remove();
        doc.select("noscript").remove();

        String css = extractCss(doc, url);
        Set<String> assets = collectAssets(doc);

        String bodyHtml = doc.body() != null ? doc.body().html() : "";
        String safeHtml = EmailHtmlSanitizer.sanitize(bodyHtml);

        log.info("Import URL Studio: {} → {} Ko HTML, {} Ko CSS, {} asset(s)",
                maskHost(url), safeHtml.length() / 1024, css.length() / 1024, assets.size());

        return new SiteImportResultDto(safeHtml, css, assets.stream().limit(MAX_ASSETS).toList());
    }

    // ── Extraction CSS ──────────────────────────────────────────────────────

    /**
     * Agrège le CSS de la page : blocs {@code <style>} inline puis feuilles
     * liées first-party / CDN courants, re-téléchargées via le fetcher épinglé.
     * Une feuille en échec est ignorée (best-effort, l'import reste utilisable).
     */
    private String extractCss(Document doc, String pageUrl) {
        StringBuilder cssBuilder = new StringBuilder();

        for (Element style : doc.select("style")) {
            cssBuilder.append("/* inline style */\n").append(style.data()).append("\n\n");
        }

        String baseHost = hostOf(pageUrl);
        int fetched = 0;
        for (Element link : doc.select("link[rel=stylesheet]")) {
            if (fetched >= MAX_LINKED_STYLESHEETS) {
                break;
            }
            String href = link.absUrl("href");
            if (href.isEmpty() || !isFirstPartyOrCdn(href, baseHost)) {
                continue;
            }
            try {
                // Re-téléchargement SSRF-safe : la feuille de style est une URL externe distincte.
                PinnedSiteFetcher.FetchedResource sheet = siteFetcher.fetch(href, MAX_STYLESHEET_BYTES);
                cssBuilder.append("/* ").append(href).append(" */\n")
                        .append(new String(sheet.body(), StandardCharsets.UTF_8)).append("\n\n");
                fetched++;
            } catch (Exception e) {
                // Best-effort : une feuille manquante ne casse pas l'import.
                log.debug("Feuille de style ignorée {}: {}", href, e.getMessage());
            }
        }
        return cssBuilder.toString();
    }

    /**
     * Autorise le re-téléchargement d'une feuille de style si elle est servie par
     * le même hôte que la page ou par un CDN courant. La garde n'est qu'un filtre
     * de pertinence : la sécurité réelle reste {@link PinnedSiteFetcher} (le filtre
     * par {@code contains} étant contournable).
     */
    private boolean isFirstPartyOrCdn(String href, String baseHost) {
        String sheetHost = hostOf(href);
        if (sheetHost == null) {
            return false;
        }
        if (sheetHost.equalsIgnoreCase(baseHost)) {
            return true;
        }
        return sheetHost.contains("googleapis.com")
                || sheetHost.contains("gstatic.com")
                || sheetHost.contains("cdnjs.cloudflare.com")
                || sheetHost.contains("jsdelivr.net")
                || sheetHost.contains("unpkg.com");
    }

    // ── Extraction des assets ─────────────────────────────────────────────────

    /**
     * Collecte les URLs absolues des assets référencés (images, vidéos, posters,
     * sources). Dédupliquées et bornées ; les data: URI et entrées vides sont
     * écartées.
     */
    private Set<String> collectAssets(Document doc) {
        Set<String> assets = new LinkedHashSet<>();
        addAbsUrls(assets, doc.select("img[src]"), "src");
        addAbsUrls(assets, doc.select("source[src]"), "src");
        addAbsUrls(assets, doc.select("video[poster]"), "poster");
        addAbsUrls(assets, doc.select("video[src]"), "src");
        return assets;
    }

    private void addAbsUrls(Set<String> sink, Elements elements, String attr) {
        for (Element el : elements) {
            if (sink.size() >= MAX_ASSETS) {
                return;
            }
            String abs = el.absUrl(attr);
            if (!abs.isEmpty() && !abs.startsWith("data:")) {
                sink.add(abs);
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String hostOf(String url) {
        try {
            return URI.create(url).getHost();
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Ne logge que l'hôte (jamais l'URL complète, qui peut porter un token en query). */
    private String maskHost(String url) {
        String host = hostOf(url);
        return host != null ? host : "url invalide";
    }
}
