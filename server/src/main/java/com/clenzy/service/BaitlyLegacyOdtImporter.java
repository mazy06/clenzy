package com.clenzy.service;

import com.clenzy.exception.DocumentValidationException;
import org.w3c.dom.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipInputStream;

/** Lecture des sources historiques uniquement. Aucun ODT rempli ni appel LibreOffice n'est produit. */
public final class BaitlyLegacyOdtImporter {
    private BaitlyLegacyOdtImporter() {}
    private static final int MAX_ENTRY = 10 * 1024 * 1024;
    private static final int MAX_TOTAL = 32 * 1024 * 1024;
    private static final Map<String, String> CSS_PROPERTIES = Map.ofEntries(
            Map.entry("font-size", "font-size"), Map.entry("font-weight", "font-weight"),
            Map.entry("font-style", "font-style"), Map.entry("color", "color"),
            Map.entry("background-color", "background-color"), Map.entry("text-align", "text-align"),
            Map.entry("margin-top", "margin-top"), Map.entry("margin-bottom", "margin-bottom"),
            Map.entry("margin-left", "margin-left"), Map.entry("margin-right", "margin-right"),
            Map.entry("padding", "padding"), Map.entry("padding-top", "padding-top"),
            Map.entry("padding-bottom", "padding-bottom"), Map.entry("padding-left", "padding-left"),
            Map.entry("padding-right", "padding-right"), Map.entry("border", "border"),
            Map.entry("border-bottom", "border-bottom"), Map.entry("border-top", "border-top"),
            Map.entry("border-left", "border-left"), Map.entry("border-right", "border-right"),
            Map.entry("column-width", "width"), Map.entry("width", "width"),
            Map.entry("vertical-align", "vertical-align"), Map.entry("line-height", "line-height"),
            Map.entry("break-before", "break-before"), Map.entry("break-after", "break-after"));

    public static boolean isOdt(byte[] bytes) {
        return bytes != null && bytes.length > 3 && bytes[0] == 'P' && bytes[1] == 'K';
    }

    public static byte[] html(byte[] source) {
        if (!isOdt(source)) return source;
        try {
            Map<String, byte[]> files = new HashMap<>();
            int total = 0;
            try (var zip = new ZipInputStream(new ByteArrayInputStream(source))) {
                java.util.zip.ZipEntry entry;
                int count = 0;
                while ((entry = zip.getNextEntry()) != null) {
                    if (++count > 200 || entry.getName().contains("..")) throw invalid();
                    byte[] bytes = zip.readNBytes(MAX_ENTRY + 1);
                    total += bytes.length;
                    if (bytes.length > MAX_ENTRY || total > MAX_TOTAL) throw invalid();
                    files.put(entry.getName(), bytes);
                }
            }
            if (!files.containsKey("content.xml")) throw invalid();
            var content = parse(files.get("content.xml"));
            Map<String, Element> styles = new LinkedHashMap<>();
            org.w3c.dom.Document styleDoc = files.containsKey("styles.xml") ? parse(files.get("styles.xml")) : null;
            for (var xml : styleDoc == null ? List.of(content) : List.of(styleDoc, content)) {
                var nodes = xml.getElementsByTagNameNS("*", "style");
                for (int i = 0; i < nodes.getLength(); i++) {
                    Element style = (Element) nodes.item(i);
                    styles.put(attr(style, "name"), style);
                }
            }
            var text = content.getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:office:1.0", "text");
            if (text.getLength() != 1) throw invalid();
            String body = children(text.item(0), styles, files);
            if (styleDoc != null) {
                for (String name : List.of("header", "footer")) {
                    var sections = styleDoc.getElementsByTagNameNS("*", name);
                    if (sections.getLength() > 1) throw new DocumentValidationException("Ce modèle ODT utilise plusieurs en-têtes. Importez sa version HTML vérifiée.");
                    if (sections.getLength() == 1) {
                        String section = "<" + name + ">" + children(sections.item(0), styles, files) + "</" + name + ">";
                        body = name.equals("header") ? section + body : body + section;
                    }
                }
            }
            // Un modèle sans identité dynamique ne reçoit pas une nouvelle variable obligatoire.
            String title = body.contains("${entreprise.nom}") ? "${entreprise.nom} · Document" : "Document Baitly";
            String html = BaitlyDocumentHtml.page(title, body);
            return html.getBytes(StandardCharsets.UTF_8);
        } catch (DocumentValidationException e) { throw e; }
        catch (Exception e) { throw new DocumentValidationException("Ancien modèle ODT illisible : importez une version HTML vérifiée."); }
    }

    private static org.w3c.dom.Document parse(byte[] bytes) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
    }

    private static String children(Node node, Map<String, Element> styles, Map<String, byte[]> files) {
        var result = new StringBuilder();
        for (Node child = node.getFirstChild(); child != null; child = child.getNextSibling()) result.append(render(child, styles, files));
        return result.toString();
    }

    private static String render(Node node, Map<String, Element> styles, Map<String, byte[]> files) {
        if (node.getNodeType() == Node.TEXT_NODE) return escapeTemplateText(node.getNodeValue());
        if (!(node instanceof Element e)) return "";
        String name = e.getLocalName();
        if (Set.of("object", "object-ole", "plugin", "applet", "custom-shape", "text-box", "note", "tracked-changes").contains(name))
            throw new DocumentValidationException("Élément ODT non convertible automatiquement (" + name + "). Importez une version HTML vérifiée.");
        if (Set.of("sequence-decls", "variable-decls", "user-field-decls", "bookmark", "bookmark-start", "bookmark-end", "soft-page-break", "covered-table-cell").contains(name)) return "";
        if (name.equals("line-break")) return "<br>";
        if (name.equals("tab")) return "&#8195;";
        if (name.equals("s")) return "&#160;".repeat(count(e, "c", 1));
        if (name.equals("image")) {
            String ref = attr(e, "href");
            byte[] image = files.get(ref.startsWith("./") ? ref.substring(2) : ref);
            if (image == null) throw new DocumentValidationException("Image ODT non incorporée : importez un modèle HTML autonome.");
            String src = "data:" + BaitlyHtmlTemplates.imageMime(image) + ";base64," + Base64.getEncoder().encodeToString(image);
            String field = e.getParentNode() instanceof Element frame ? attr(frame, "name") : "";
            // Convention historique XDocReport : le nom de frame porte la clé d'image.
            if (field.matches("logo(?:_[a-zA-Z0-9_]+)?"))
                return "[#if " + field + "?? && " + field + "?has_content]<img src=\"${" + field + "}\" alt=\"\">[#else]<strong>${entreprise.nom}</strong>[/#if]";
            if (field.matches("(?:signature|photo|cachet)(?:_[a-zA-Z0-9_]+)?"))
                return "[#if " + field + "?? && " + field + "?has_content]<img src=\"${" + field + "}\" alt=\"\">[#else]<img src=\"" + src + "\" alt=\"\">[/#if]";
            return "<img src=\"" + src + "\" alt=\"\">";
        }
        String inside = children(e, styles, files);
        String tag = switch (name) {
            case "p" -> "p";
            case "h" -> "h2";
            case "span", "frame" -> "span";
            case "table" -> "table";
            case "table-row" -> "tr";
            case "table-cell" -> "td";
            case "table-header-rows" -> "thead";
            case "table-column" -> "col";
            case "list" -> "ul";
            case "list-item" -> "li";
            case "a" -> "span"; // Le texte du lien reste présent ; pas de chargement externe.
            default -> "";
        };
        if (tag.isEmpty()) return inside;
        // Une directive seule est structurelle, jamais un paragraphe vide ni une cellule ajoutée.
        if (name.equals("p") && inside.trim().matches("(?s)\\[/?#.+]")) return inside.trim();
        String css = css(e, styles, new HashSet<>());
        if (name.equals("frame")) {
            String width = attr(e, "width");
            if (width.matches("[\\d.]+(cm|mm|in|pt|px)")) css += "display:inline-block;width:" + width + ";";
        }
        String attrs = css.isEmpty() ? "" : " style=\"" + BaitlyDocumentHtml.escape(css) + "\"";
        if (tag.equals("td")) {
            if (!attr(e, "number-columns-spanned").isEmpty()) attrs += " colspan=\"" + count(e, "number-columns-spanned", 1) + "\"";
            if (!attr(e, "number-rows-spanned").isEmpty()) attrs += " rowspan=\"" + count(e, "number-rows-spanned", 1) + "\"";
        }
        String result = "<" + tag + attrs + ">" + (tag.equals("col") ? "" : inside + "</" + tag + ">");
        return result.repeat(count(e, name.equals("table-row") ? "number-rows-repeated" : "number-columns-repeated", 1));
    }

    private static String css(Element e, Map<String, Element> styles, Set<String> visited) {
        String styleName = attr(e, "style-name");
        if (styleName.isEmpty()) styleName = attr(e, "parent-style-name");
        var css = new StringBuilder();
        if (!styleName.isEmpty() && visited.add(styleName) && styles.containsKey(styleName)) css.append(css(styles.get(styleName), styles, visited));
        if (e.getLocalName().equals("style")) for (Node n = e.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (!(n instanceof Element property)) continue;
            var attrs = property.getAttributes();
            for (int i = 0; i < attrs.getLength(); i++) {
                var a = attrs.item(i);
                String key = CSS_PROPERTIES.get(a.getLocalName());
                String value = a.getNodeValue();
                if (key != null && value.matches("[a-zA-Z0-9# .%,-]+")) css.append(key).append(':').append(value).append(';');
            }
            if (attr(property, "keep-with-next").equals("always")) css.append("break-after:avoid;");
        }
        return css.toString();
    }

    private static int count(Element e, String key, int fallback) {
        String value = attr(e, key);
        if (value.isEmpty()) return fallback;
        try { int n = Integer.parseInt(value); if (n < 1 || n > 100) throw invalid(); return n; }
        catch (NumberFormatException ex) { throw invalid(); }
    }
    private static String attr(Element e, String key) {
        var attrs = e.getAttributes();
        for (int i = 0; i < attrs.getLength(); i++) if (key.equals(attrs.item(i).getLocalName())) return attrs.item(i).getNodeValue();
        return "";
    }
    private static String escapeTemplateText(String value) {
        // Les marques historiques sont des libellés de modèle, pas des données du dossier.
        // Un titre isolé prend l'identité de l'émetteur ; le crédit logiciel devient Baitly.
        if (value.strip().equalsIgnoreCase("clenzy")) return "${entreprise.nom}";
        value = value.replaceAll("(?i)Pour\\s+clenzy\\b", java.util.regex.Matcher.quoteReplacement("Pour ${entreprise.nom}"));
        value = value.replaceAll("(?i)(?<![@./])\\bclenzy\\b(?![./])", "Baitly");
        var matcher = java.util.regex.Pattern.compile("\\$\\{[^}]+}|\\[/?#.*?]", java.util.regex.Pattern.DOTALL).matcher(value);
        var out = new StringBuilder(); int end = 0;
        while (matcher.find()) { out.append(BaitlyDocumentHtml.escape(value.substring(end, matcher.start()))).append(matcher.group()); end = matcher.end(); }
        return out.append(BaitlyDocumentHtml.escape(value.substring(end))).toString();
    }
    private static DocumentValidationException invalid() { return new DocumentValidationException("Source ODT historique invalide ou trop volumineuse."); }
}
