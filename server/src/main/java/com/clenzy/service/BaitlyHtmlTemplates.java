package com.clenzy.service;

import com.clenzy.exception.DocumentValidationException;
import freemarker.core.HTMLOutputFormat;
import freemarker.core.TemplateClassResolver;
import freemarker.template.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

/** Modèles HTML avec échappement automatique et contexte réduit aux données. Aucun code Java exposé. */
public final class BaitlyHtmlTemplates {
    public static final int MAX_SOURCE_BYTES = 5 * 1024 * 1024;
    private static final int MAX_OUTPUT_CHARS = 12 * 1024 * 1024;
    private static final Configuration CONFIG = configuration();
    private static final Pattern DIRECTIVE = Pattern.compile("(?:<|\\[)/?([#@])\\s*([a-zA-Z_]\\w*)");
    private static final Set<String> DIRECTIVES = Set.of("if", "else", "elseif", "list", "sep");

    private BaitlyHtmlTemplates() {}

    private static Configuration configuration() {
        var c = new Configuration(Configuration.VERSION_2_3_34);
        c.setDefaultEncoding("UTF-8");
        c.setTagSyntax(Configuration.AUTO_DETECT_TAG_SYNTAX);
        c.setObjectWrapper(new SimpleObjectWrapper(Configuration.VERSION_2_3_34));
        c.setNewBuiltinClassResolver(TemplateClassResolver.ALLOWS_NOTHING_RESOLVER);
        c.setAPIBuiltinEnabled(false);
        c.setOutputFormat(HTMLOutputFormat.INSTANCE);
        c.setAutoEscapingPolicy(Configuration.FORCE_AUTO_ESCAPING_POLICY);
        c.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
        c.setLogTemplateExceptions(false);
        c.setFallbackOnNullLoopVariable(false);
        c.setLocalizedLookup(false);
        c.setNumberFormat("computer");
        return c;
    }

    public static String source(byte[] bytes) {
        if (bytes == null || bytes.length == 0 || bytes.length > MAX_SOURCE_BYTES)
            throw invalid("Le modèle HTML doit contenir entre 1 octet et 5 Mo.");
        String source;
        try {
            source = StandardCharsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(bytes)).toString();
        } catch (java.nio.charset.CharacterCodingException e) { throw invalid("Le modèle doit être encodé en UTF-8."); }
        if (!source.toLowerCase(Locale.ROOT).contains("<html") || !source.toLowerCase(Locale.ROOT).contains("<body"))
            throw invalid("Un document HTML complet avec html et body est requis.");
        var directives = DIRECTIVE.matcher(source);
        while (directives.find()) {
            if (!"#".equals(directives.group(1)) || !DIRECTIVES.contains(directives.group(2)))
                throw invalid("Directive de modèle non autorisée : " + directives.group(2));
        }
        if (Pattern.compile("\\?(?:eval|interpret|new|api|no_esc)\\b|\\.data_model|\\.globals", Pattern.CASE_INSENSITIVE).matcher(source).find())
            throw invalid("Expression de modèle non autorisée.");
        // Les directives sont validées avant le parse HTML, puis les ressources et scripts avant/après interpolation.
        validateResources(source);
        try { new Template("document.html", new StringReader(source), CONFIG); }
        catch (IOException e) { throw invalid("Syntaxe du modèle HTML invalide : " + e.getMessage()); }
        return source;
    }

    public static byte[] render(byte[] bytes, Map<String, Object> context) {
        String source = source(bytes);
        // Le résolveur fournit déjà l'unité. Compatibilité avec les anciens modèles qui la répétaient.
        if (context.get("property") instanceof Map<?, ?> property
                && property.get("surface") instanceof String surface && surface.stripTrailing().endsWith("m²"))
            source = source.replaceAll("(\\$\\{property\\.surface})[\\s\\u00a0]+m²", "$1");
        try {
            var out = new StringWriter() {
                private void check(int len) {
                    if ((long) getBuffer().length() + len > MAX_OUTPUT_CHARS) throw invalid("Le document dépasse la taille autorisée.");
                }
                @Override public void write(char[] b, int off, int len) {
                    check(len);
                    super.write(b, off, len);
                }
                @Override public void write(String s) { check(s.length()); super.write(s); }
                @Override public void write(String s, int off, int len) { check(len); super.write(s, off, len); }
                @Override public void write(int c) { check(1); super.write(c); }
            };
            new Template("document.html", new StringReader(source), CONFIG).process(data(context, 0), out);
            String html = out.toString();
            validateResources(html);
            return html.getBytes(StandardCharsets.UTF_8);
        } catch (TemplateException | IOException e) {
            throw invalid("Impossible de remplir le modèle HTML : " + e.getMessage());
        }
    }

    private static Object data(Object value, int depth) {
        if (depth > 12) throw invalid("Contexte de document trop profond.");
        if (value == null || value instanceof String || value instanceof Number || value instanceof Boolean) return value;
        if (value instanceof byte[] bytes) {
            String mime = imageMime(bytes);
            return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
        }
        if (value instanceof Map<?, ?> map) {
            if (map.size() > 10000) throw invalid("Contexte de document trop volumineux.");
            var result = new LinkedHashMap<String, Object>();
            map.forEach((k, v) -> result.put(k.toString(), data(v, depth + 1)));
            return result;
        }
        if (value instanceof Collection<?> list) {
            if (list.size() > 10000) throw invalid("Liste de document trop volumineuse.");
            return list.stream().map(v -> data(v, depth + 1)).toList();
        }
        if (value instanceof java.time.temporal.TemporalAccessor || value instanceof UUID || value instanceof Enum<?>) return value.toString();
        throw invalid("Type de donnée non pris en charge dans le modèle.");
    }

    static String imageMime(byte[] bytes) {
        if (bytes.length > MAX_SOURCE_BYTES) throw invalid("Image trop volumineuse.");
        if (bytes.length >= 8 && bytes[0] == (byte) 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71) return "image/png";
        if (bytes.length >= 3 && bytes[0] == (byte) 255 && bytes[1] == (byte) 216 && bytes[2] == (byte) 255) return "image/jpeg";
        if (bytes.length >= 6 && new String(bytes, 0, 6, StandardCharsets.US_ASCII).matches("GIF8[79]a")) return "image/gif";
        throw invalid("Seules les images PNG, JPEG et GIF incorporées sont autorisées.");
    }

    /** Aucun accès réseau ou fichier depuis Chromium, y compris dans un modèle administrateur. */
    public static void validateResources(String html) {
        var doc = Jsoup.parse(html);
        if (!doc.select("script,iframe,object,embed,base,link,form,video,audio,foreignObject").isEmpty())
            throw invalid("Scripts, formulaires et ressources externes sont interdits dans les documents.");
        for (Element e : doc.getAllElements()) {
            for (var a : e.attributes()) {
                String key = a.getKey().toLowerCase(Locale.ROOT);
                String value = a.getValue().trim();
                if (key.startsWith("on") || key.equals("srcdoc") || key.equals("srcset") || key.equals("background")) throw invalid("Attribut HTML non autorisé.");
                if (Set.of("src", "href", "xlink:href", "poster").contains(key)) {
                    boolean image = e.tagName().equals("img") && key.equals("src") && (value.matches("data:image/(png|jpeg|gif);base64,[A-Za-z0-9+/=\\s]+") || value.matches("\\$\\{[a-zA-Z_][\\w.]*}"));
                    boolean link = e.tagName().equals("a") && key.equals("href") && (value.startsWith("#") || value.startsWith("https://") || value.startsWith("mailto:"));
                    boolean svgLocal = key.endsWith("href") && value.startsWith("#");
                    if (!image && !link && !svgLocal) throw invalid("Les images doivent être incorporées ; les ressources distantes ne sont pas autorisées.");
                }
            }
        }
        // Refuser également les séquences CSS obfusquées. Les styles internes n'en ont pas besoin.
        String css = doc.select("style").stream().map(Element::data).collect(java.util.stream.Collectors.joining("\n"))
                + doc.select("[style]").stream().map(e -> e.attr("style")).collect(java.util.stream.Collectors.joining("\n"));
        String normalized = css.replaceAll("(?s)/\\*.*?\\*/", "").toLowerCase(Locale.ROOT);
        if (normalized.contains("\\") || normalized.contains("url(") || normalized.contains("@import") || normalized.contains("expression(") || normalized.contains("image-set("))
            throw invalid("Les styles doivent être autonomes, sans chargement de ressources.");
        if (!doc.select("meta[http-equiv]").isEmpty()) throw invalid("Redirections HTML interdites.");
    }

    private static DocumentValidationException invalid(String message) { return new DocumentValidationException(message); }
}
