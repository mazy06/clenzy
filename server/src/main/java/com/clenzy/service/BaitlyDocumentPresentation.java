package com.clenzy.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.TextNode;
import org.jsoup.nodes.Node;

/** Charte commune appliquée aux nouveaux rendus, sans modifier les sources ni les PDF archivés. */
final class BaitlyDocumentPresentation {
    private BaitlyDocumentPresentation() {}
    private static final Pattern SIZE = Pattern.compile("font-size\\s*:\\s*([0-9.]+)pt", Pattern.CASE_INSENSITIVE);
    private static final String CSS = stylesheet();

    static void apply(Document document) {
        if (document.body().hasAttr("data-baitly-document")) return;
        document.body().attr("data-baitly-document", "1").addClass("baitly-document");
        promoteLegacyHeadings(document);
        normalizeLegacyStyles(document);
        groupFlatSections(document.body());
        for (Element table : document.select("body > table, .baitly-doc-header > table")) {
            if (table.select("thead,th").isEmpty() && table.select("tr").size() == 1 && table.select("td").size() == 2
                    && table.select("p").size() > 2) table.addClass(table.select("h1").isEmpty() ? "baitly-doc-identities" : "baitly-doc-masthead");
        }
        document.head().appendElement("style").attr("id", "baitly-document-design").appendChild(new org.jsoup.nodes.DataNode(CSS));
    }

    private static void promoteLegacyHeadings(Document document) {
        boolean hasTitle = !document.select("h1").isEmpty();
        // Les sources ODT présentent la société à gauche et le titre du document à droite.
        Element firstTable = document.selectFirst("body > table");
        if (!hasTitle && firstTable != null && firstTable.select("tr").size() == 1 && firstTable.select("td").size() == 2) {
            Element right = firstTable.select("td").get(1);
            for (Element p : right.select("p[style]")) {
                var size = SIZE.matcher(p.attr("style"));
                if (size.find() && Double.parseDouble(size.group(1)) >= 16) {
                    p.tagName("h1"); hasTitle = true;
                    Element issuer = firstTable.select("td").first().selectFirst("p");
                    if (issuer != null) issuer.addClass("baitly-doc-issuer");
                    break;
                }
            }
        }
        for (Element p : document.select("p[style]")) {
            String style = p.attr("style").toLowerCase(Locale.ROOT);
            var size = SIZE.matcher(style);
            if (!size.find() || !style.matches("(?s).*font-weight\\s*:\\s*(bold|[6-9]00).*")) continue;
            double points = Double.parseDouble(size.group(1));
            if (p.text().isBlank() || p.text().length() > 100) continue;
            if (!hasTitle && points >= 16) { p.tagName("h1"); hasTitle = true; }
            else if ((points >= 11 || style.contains("border-bottom")) && p.parent() == document.body()) p.tagName("h2");
        }
    }

    private static void normalizeLegacyStyles(Document document) {
        if (document.select("body p[style]").size() < 8) return;
        document.body().addClass("baitly-legacy-document");
        for (Element element : document.select("body [style]")) {
            if (element.hasClass("baitly-preview-watermark") || element.hasClass("baitly-preview-notice")) continue;
            StringBuilder retained = new StringBuilder();
            for (String declaration : element.attr("style").split(";")) {
                String[] parts = declaration.split(":", 2);
                if (parts.length != 2) continue;
                String property = parts[0].trim().toLowerCase(Locale.ROOT), value = parts[1].trim();
                if (Set.of("font-family", "font-size", "line-height", "color").contains(property)) continue;
                if (property.equals("background-color") || property.equals("background")) {
                    if (!Set.of("#ffffff", "#fff", "white", "transparent", "none").contains(value.toLowerCase(Locale.ROOT)))
                        element.addClass("baitly-doc-soft");
                    continue;
                }
                if (Set.of("border", "border-top", "border-bottom", "border-left", "border-right").contains(property)) {
                    if (!value.equals("none") && !value.equals("0")) retained.append(property).append(":1px solid #d5e1eb;");
                    continue;
                }
                retained.append(property).append(':').append(value).append(';');
            }
            element.attr("style", retained.toString());
        }
        // Les séparateurs décoratifs des ODT ne doivent pas conserver leur ancienne palette.
        for (Element img : document.select("img[src^='data:image/png;base64,']")) {
            try {
                byte[] bytes = java.util.Base64.getDecoder().decode(img.attr("src").substring("data:image/png;base64,".length()));
                if (bytes.length < 24) continue;
                var dimensions = java.nio.ByteBuffer.wrap(bytes, 16, 8);
                int width = dimensions.getInt(), height = dimensions.getInt();
                if (width > 500 && height > 0 && height <= 16 && width / height > 40) img.replaceWith(new Element("hr"));
            } catch (IllegalArgumentException ignored) { /* La validation des ressources reste assurée par le moteur. */ }
        }
    }

    /** Les anciens blocs empilés deviennent des sections ; les identités voisines partagent une rangée. */
    private static void groupFlatSections(Element body) {
        if (body.children().stream().noneMatch(e -> e.normalName().equals("h2"))) return;
        var original = new ArrayList<>(body.childNodes());
        Element current = null;
        Element identityGrid = null;
        Element header = null;
        boolean started = false;
        for (Node node : original) {
            if (!(node instanceof Element element)) {
                if (current != null) current.appendChild(node);
                else if (header != null && !started) header.appendChild(node);
                continue;
            }
            if (element.hasClass("baitly-preview-watermark") || element.hasClass("baitly-preview-notice") || element.normalName().equals("footer")) {
                current = null; identityGrid = null; continue;
            }
            if (element.normalName().equals("h2")) {
                started = true;
                boolean identity = isIdentity(element.text());
                current = new Element("section").addClass("baitly-doc-section");
                element.before(current);
                current.appendChild(element);
                if (identity) {
                    current.addClass("baitly-doc-identity");
                    if (identityGrid == null) {
                        identityGrid = new Element("div").addClass("baitly-doc-grid"); current.before(identityGrid);
                    }
                    identityGrid.appendChild(current);
                } else identityGrid = null;
            } else if (current != null) current.appendChild(element);
            else if (!started && !Set.of("header", "style").contains(element.normalName())) {
                if (header == null) { header = new Element("header").addClass("baitly-doc-header"); element.before(header); }
                header.appendChild(element);
            }
        }
        for (Element section : body.select(".baitly-doc-section")) {
            for (Element p : new ArrayList<>(section.children())) {
                if (!p.normalName().equals("p") || !p.children().isEmpty()) continue;
                String text = p.text();
                int separator = text.indexOf(':');
                if (separator <= 0 || separator > 34 || text.length() > 260 || text.substring(separator + 1).contains(": ")) continue;
                p.empty().addClass("baitly-doc-field");
                p.appendElement("span").addClass("baitly-doc-label").text(text.substring(0, separator + 1).trim());
                p.appendElement("span").appendChild(new TextNode(text.substring(separator + 1).trim()));
            }
        }
    }

    private static boolean isIdentity(String text) {
        String normalized = java.text.Normalizer.normalize(text.toLowerCase(Locale.ROOT), java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return Set.of("client", "proprietaire", "gestionnaire", "prestataire", "technicien intervenant", "intervenant", "beneficiaire", "emetteur", "destinataire").contains(normalized.trim());
    }

    private static String stylesheet() {
        try (var source = BaitlyDocumentPresentation.class.getResourceAsStream("/documents/baitly-document.css")) {
            if (source == null) throw new IllegalStateException("Charte documentaire absente");
            return new String(source.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) { throw new IllegalStateException("Charte documentaire illisible", e); }
    }
}
