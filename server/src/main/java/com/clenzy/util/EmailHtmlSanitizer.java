package com.clenzy.util;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Sanitisation HTML conservatrice pour le contenu des templates email
 * editables par les utilisateurs (overrides per-org des templates systeme).
 *
 * <p>Approche par SUPPRESSION ciblee (pas de reformatage) : le contenu
 * legitime — plain text avec sauts de ligne, mini-markdown ({@code *gras*},
 * {@code _italique_}) et blocs HTML email-safe ({@code <table>}, {@code <div>},
 * styles inline) — reste byte-identique. Seuls les constructs dangereux sont
 * retires :</p>
 * <ul>
 *   <li>elements {@code <script>}, {@code <iframe>}, {@code <object>} (avec
 *       leur contenu) et {@code <embed>}</li>
 *   <li>attributs event-handler {@code on*=} (onerror, onclick, onload…)</li>
 *   <li>URLs {@code javascript:}, {@code vbscript:} et {@code data:} dans les
 *       attributs href/src/action/formaction/xlink:href/background — y compris
 *       obfusquees (espaces/controles intercales, entites numeriques,
 *       {@code &colon;})</li>
 * </ul>
 *
 * <p><b>Pourquoi pas {@code Jsoup.clean()}</b> (pourtant en dependance) : le
 * body des templates est du plain text + mini-markdown edite dans un editeur
 * texte ; jsoup re-serialise le document (entites echappees, whitespace
 * normalise), ce qui corromprait le round-trip editeur → stockage → editeur.
 * La suppression ciblee laisse le contenu legitime intact.</p>
 *
 * <p>La sanitisation boucle jusqu'a stabilite (fixpoint) pour neutraliser les
 * payloads imbriques (ex. {@code <scr<script>ipt>}).</p>
 */
public final class EmailHtmlSanitizer {

    /** Elements dont le contenu est lui-meme dangereux : supprimes avec leur contenu. */
    private static final Pattern PAIRED_DANGEROUS = Pattern.compile(
        "(?is)<(script|iframe|object)\\b[^>]*>.*?</\\1\\s*>");

    /** Balises dangereuses residuelles (orphelines, non fermees, embed). */
    private static final Pattern ORPHAN_DANGEROUS = Pattern.compile(
        "(?is)</?(script|iframe|object|embed)\\b[^>]*>?");

    /** Toute balise HTML — perimetre du nettoyage d'attributs (jamais le texte). */
    private static final Pattern TAG = Pattern.compile("<[a-zA-Z][^>]*>");

    /**
     * Attribut event-handler {@code on*=} au sein d'une balise. Le lookbehind
     * exige un separateur (whitespace ou fin de valeur quotee) pour ne pas
     * mordre dans une URL legitime contenant "...on...=".
     */
    private static final Pattern EVENT_HANDLER_ATTR = Pattern.compile(
        "(?i)(?<=[\\s\"'])on[a-z0-9_-]+\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]*)");

    /** Attributs URL dont le scheme doit etre verifie. */
    private static final Pattern URL_ATTR = Pattern.compile(
        "(?i)\\s(?:href|src|action|formaction|xlink:href|background)\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]*)");

    /** Entites numeriques HTML ({@code &#106;}, {@code &#x6A;}) dans une valeur d'attribut. */
    private static final Pattern NUMERIC_ENTITY = Pattern.compile("(?i)&#x?[0-9a-f]+;?");

    private static final Set<String> DANGEROUS_SCHEMES = Set.of("javascript", "vbscript", "data");

    private EmailHtmlSanitizer() { /* util class */ }

    /**
     * Supprime les constructs HTML dangereux du texte. {@code null} → {@code null}.
     * Le texte sans construct dangereux est retourne strictement identique.
     */
    public static String sanitize(String html) {
        if (html == null || html.isEmpty()) {
            return html;
        }
        String previous;
        String current = html;
        do {
            previous = current;
            current = PAIRED_DANGEROUS.matcher(current).replaceAll("");
            current = ORPHAN_DANGEROUS.matcher(current).replaceAll("");
            current = cleanTagAttributes(current);
        } while (!current.equals(previous));
        return current;
    }

    /** Nettoie les attributs dangereux de chaque balise, sans toucher au texte hors balise. */
    private static String cleanTagAttributes(String html) {
        Matcher tags = TAG.matcher(html);
        if (!tags.find()) {
            return html;
        }
        StringBuilder out = new StringBuilder();
        do {
            String cleaned = EVENT_HANDLER_ATTR.matcher(tags.group()).replaceAll("");
            cleaned = removeDangerousUrlAttributes(cleaned);
            tags.appendReplacement(out, Matcher.quoteReplacement(cleaned));
        } while (tags.find());
        tags.appendTail(out);
        return out.toString();
    }

    /** Supprime les attributs URL (href/src/…) dont le scheme est dangereux. */
    private static String removeDangerousUrlAttributes(String tag) {
        Matcher urls = URL_ATTR.matcher(tag);
        if (!urls.find()) {
            return tag;
        }
        StringBuilder out = new StringBuilder();
        do {
            String replacement = hasDangerousScheme(unquote(urls.group(1)))
                ? "" : Matcher.quoteReplacement(urls.group());
            urls.appendReplacement(out, replacement);
        } while (urls.find());
        urls.appendTail(out);
        return out.toString();
    }

    private static String unquote(String value) {
        if (value.length() >= 2
                && (value.charAt(0) == '"' || value.charAt(0) == '\'')
                && value.charAt(value.length() - 1) == value.charAt(0)) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    /**
     * Detecte un scheme dangereux meme obfusque : entites numeriques decodees,
     * whitespace/caracteres de controle retires avant comparaison.
     */
    private static boolean hasDangerousScheme(String rawValue) {
        String value = decodeBasicEntities(rawValue)
            .replaceAll("[\\s\\p{Cntrl}]", "")
            .toLowerCase(Locale.ROOT);
        int colon = value.indexOf(':');
        if (colon < 0) {
            return false;
        }
        return DANGEROUS_SCHEMES.contains(value.substring(0, colon));
    }

    /** Decode les entites numeriques + {@code &colon;}/{@code &tab;}/{@code &newline;} (check de scheme uniquement). */
    private static String decodeBasicEntities(String value) {
        if (value.indexOf('&') < 0) {
            return value;
        }
        Matcher entities = NUMERIC_ENTITY.matcher(value);
        StringBuilder out = new StringBuilder();
        while (entities.find()) {
            entities.appendReplacement(out, Matcher.quoteReplacement(decodeNumericEntity(entities.group())));
        }
        entities.appendTail(out);
        return out.toString()
            .replaceAll("(?i)&colon;", ":")
            .replaceAll("(?i)&tab;", "\t")
            .replaceAll("(?i)&newline;", "\n");
    }

    private static String decodeNumericEntity(String entity) {
        try {
            boolean hex = entity.regionMatches(true, 0, "&#x", 0, 3);
            String digits = entity.substring(hex ? 3 : 2)
                .replace(";", "");
            int codePoint = Integer.parseInt(digits, hex ? 16 : 10);
            return new String(Character.toChars(codePoint));
        } catch (RuntimeException e) {
            return entity; // entite invalide : laissee telle quelle
        }
    }
}
