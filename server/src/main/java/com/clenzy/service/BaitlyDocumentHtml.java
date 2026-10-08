package com.clenzy.service;

import com.clenzy.util.StringUtils;

/** Présentation HTML commune aux documents Baitly, indépendante du transport email/PDF. */
public final class BaitlyDocumentHtml {
    private BaitlyDocumentHtml() {}

    public static String page(String title, String body) {
        return "<!doctype html><html lang=\"fr\"><head><meta charset=\"UTF-8\"><title>"
                + escape(title) + "</title><style>" + CSS + "</style></head><body>" + body + "</body></html>";
    }

    public static String escape(Object value) {
        return StringUtils.escapeHtml(value == null ? "" : value.toString());
    }

    public static String paragraph(Object value) {
        return "<p>" + escape(value).replace("\n", "<br>") + "</p>";
    }

    public static String row(String label, Object value) {
        return "<tr><th scope=\"row\">" + escape(label) + "</th><td>" + escape(value) + "</td></tr>";
    }

    public static final String CSS = """
            @page { size: A4; margin: 16mm 14mm; }
            * { box-sizing: border-box; }
            body { color:#1b2a35; background:#fcfdff; font:10pt/1.5 Arial,sans-serif; margin:0; }
            h1 { color:#193d67; font-size:21pt; line-height:1.2; margin:0 0 8mm; }
            h2 { color:#193d67; font-size:13pt; margin:7mm 0 3mm; break-after:avoid; }
            h3 { font-size:11pt; break-after:avoid; }
            p { margin:0 0 3mm; overflow-wrap:anywhere; }
            table { border-collapse:collapse; width:100%; margin:3mm 0 5mm; font-size:9pt; }
            thead { display:table-header-group; }
            tr { break-inside:avoid; }
            th,td { padding:2.5mm; text-align:left; vertical-align:top; border-bottom:1px solid #d4dfe9; overflow-wrap:anywhere; }
            th { background:#e7eef4; font-weight:600; }
            img { max-width:100%; height:auto; }
            .muted,footer { color:#526879; font-size:8pt; }
            .page-break { break-before:page; }
            .amount { font-variant-numeric:tabular-nums; }
            """;
}
