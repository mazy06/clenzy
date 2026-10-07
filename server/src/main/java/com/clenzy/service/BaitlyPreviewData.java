package com.clenzy.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;

/** Jeu autonome et déterministe : aucune lecture des clients, logements ou paramètres de l'organisation. */
final class BaitlyPreviewData {
    private BaitlyPreviewData() {}

    static Map<String, Object> context() {
        try (var input = BaitlyPreviewData.class.getResourceAsStream("/documents/baitly-preview-data.json")) {
            if (input == null) throw new IllegalStateException("Données de démonstration absentes");
            return new ObjectMapper().readValue(input, new TypeReference<>() {});
        } catch (IOException e) { throw new IllegalStateException("Données de démonstration illisibles", e); }
    }

    static String watermark(String html) {
        var document = org.jsoup.Jsoup.parse(html);
        document.head().appendElement("style").appendChild(new org.jsoup.nodes.DataNode("""
            .baitly-preview-watermark { position:fixed!important; top:43%!important; left:0!important;
              width:100%!important; text-align:center!important; transform:rotate(-28deg)!important;
              font:700 34pt/1.5 Arial,sans-serif!important; color:rgba(41,74,105,.18)!important;
              z-index:2147483647!important; pointer-events:none!important; }
            .baitly-preview-notice { position:fixed!important; bottom:0!important; left:0!important; width:100%!important;
              text-align:center!important; font:8pt/1.4 Arial,sans-serif!important; color:#526879!important; z-index:2147483647!important; }
            """));
        document.body().appendElement("div").addClass("baitly-preview-watermark").text("APERÇU · DOCUMENT FICTIF");
        document.body().appendElement("div").addClass("baitly-preview-notice")
                .text("Données d’exemple · Aucune valeur légale · Aucun paiement ni engagement");
        return document.outerHtml();
    }
}
