package com.clenzy.util;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Attribute;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Entities;
import org.jsoup.parser.Parser;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Sanitisation HTML pour le contenu des templates email editables par les
 * utilisateurs (overrides per-org des templates systeme) ET pour les emails
 * "document HTML complet" deja rendus (ex. briefings).
 *
 * <p><b>Approche : jsoup en mode "arbre", document-aware</b>. Le HTML est
 * reparse par un parseur robuste ({@link Jsoup#parse(String)}) puis nettoye
 * <em>sur l'arbre</em> :</p>
 * <ul>
 *   <li>les elements dangereux ({@code script, iframe, object, embed, frame,
 *       frameset, base, form}) sont supprimes avec leur contenu ;</li>
 *   <li>tous les attributs event-handler ({@code on*=}) sont retires ;</li>
 *   <li>les attributs d'URL ({@code href, src, action, formaction, xlink:href,
 *       background}) sont retires si leur scheme, une fois decode et debarrasse
 *       des espaces/controles, est {@code javascript:}, {@code data:} ou
 *       {@code vbscript:} — ce qui couvre les obfuscations (entites numeriques,
 *       tab intercale, casse).</li>
 * </ul>
 *
 * <p><b>Pourquoi {@link Jsoup#parse(String)} et pas {@link Jsoup#clean}</b> :
 * {@code Jsoup.clean(html, "", safelist)} ne retourne qu'un FRAGMENT body et
 * <em>jette</em> la structure d'un document complet ({@code <!doctype>},
 * {@code <html>}, {@code <head>}, {@code <body>}, {@code <meta>}, {@code <title>}).
 * Or ce sanitizer est aussi applique a des emails "document HTML complet". On
 * parse donc l'arbre (qui preserve html/head/body) et on supprime
 * chirurgicalement les seuls noeuds/attributs dangereux. La structure du
 * document est conservee quand l'entree en est un ; sinon on re-serialise le
 * fragment ({@code body().html()}) sans wrapper html/body ajoute.</p>
 *
 * <p><b>Normalisation</b> : jsoup re-serialise. Le contenu n'est donc PAS
 * garanti byte-identique (caracteres {@code < > &} du texte echappes en entites,
 * {@code <tbody>} insere dans les tables, doctype en minuscules). C'est le
 * compromis assume du passage a un parseur : robustesse de la sanitisation
 * contre fidelite byte-a-byte. {@code prettyPrint(false)} evite que jsoup
 * reflowe/indente le HTML (ce qui casserait le decoupage en paragraphes en
 * aval par {@code EmailWrapperService}).</p>
 */
public final class EmailHtmlSanitizer {

    /** Elements dont la simple presence est dangereuse : supprimes avec leur contenu. */
    private static final String DANGEROUS_ELEMENTS =
        "script,iframe,object,embed,frame,frameset,base,form";

    /** Attributs d'URL dont le scheme doit etre verifie. */
    private static final Set<String> URL_ATTRIBUTES = Set.of(
        "href", "src", "action", "formaction", "xlink:href", "background");

    /** Schemes interdits dans un attribut d'URL. */
    private static final Set<String> DANGEROUS_SCHEMES = Set.of("javascript", "data", "vbscript");

    private EmailHtmlSanitizer() { /* util class */ }

    /**
     * Nettoie le HTML en supprimant les seuls constructs dangereux, tout en
     * preservant la structure d'un document HTML complet quand l'entree en est
     * un. {@code null} / vide → retourne l'entree telle quelle.
     *
     * <p>Vecteurs neutralises : elements {@code script/iframe/object/embed/
     * frame/frameset/base/form}, handlers {@code on*=}, schemes
     * {@code javascript:}/{@code data:}/{@code vbscript:} dans les attributs
     * d'URL (y compris obfusques).</p>
     */
    public static String sanitize(String html) {
        if (html == null || html.isEmpty()) {
            return html;
        }

        Document doc = Jsoup.parse(html);
        doc.outputSettings()
            .prettyPrint(false)
            .escapeMode(Entities.EscapeMode.xhtml);

        doc.select(DANGEROUS_ELEMENTS).remove();
        removeDangerousAttributes(doc);

        // Document complet (l'entree contenait <html>) → on conserve la structure
        // (doctype/html/head/body). Sinon → fragment, pas de wrapper html/body ajoute.
        return isFullDocument(html) ? doc.html() : doc.body().html();
    }

    /** Vrai si l'entree est un document HTML complet (presence d'une balise {@code <html}). */
    private static boolean isFullDocument(String html) {
        return html.toLowerCase(Locale.ROOT).contains("<html");
    }

    /** Retire les attributs event-handler {@code on*=} et les attributs d'URL a scheme dangereux. */
    private static void removeDangerousAttributes(Document doc) {
        for (Element element : doc.getAllElements()) {
            List<String> toRemove = new ArrayList<>();
            for (Attribute attribute : element.attributes()) {
                String name = attribute.getKey().toLowerCase(Locale.ROOT);
                if (name.startsWith("on")
                        || (URL_ATTRIBUTES.contains(name) && hasDangerousScheme(attribute.getValue()))) {
                    toRemove.add(attribute.getKey());
                }
            }
            toRemove.forEach(element::removeAttr);
        }
    }

    /**
     * Detecte un scheme dangereux meme obfusque : entites HTML decodees,
     * whitespace/caracteres de controle retires avant comparaison.
     */
    private static boolean hasDangerousScheme(String rawValue) {
        String value = Parser.unescapeEntities(rawValue, true)
            .replaceAll("[\\s\\p{Cntrl}]", "")
            .toLowerCase(Locale.ROOT);
        int colon = value.indexOf(':');
        if (colon < 0) {
            return false;
        }
        return DANGEROUS_SCHEMES.contains(value.substring(0, colon));
    }
}
