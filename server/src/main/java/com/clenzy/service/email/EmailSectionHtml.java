package com.clenzy.service.email;

import com.clenzy.util.StringUtils;

/**
 * Helpers de rendu HTML partages par les composers de contenu email
 * (sections encadrees + lignes de tableau label/valeur).
 *
 * <p>Tout libelle et toute valeur passes a {@link #addRow} sont echappes via
 * {@link StringUtils#escapeHtml(String)} — ne pas contourner.</p>
 */
final class EmailSectionHtml {

    private EmailSectionHtml() { /* util class */ }

    static String sectionStart(String bgColor, String title) {
        return "<div style='background: " + bgColor + "; padding: 20px; border: 1px solid #e2e8f0;'>" +
                "<h2 style='color: #334155; margin-top: 0; font-size: 16px; border-bottom: 2px solid #667eea; padding-bottom: 8px;'>" + title + "</h2>";
    }

    static void addRow(StringBuilder sb, String label, String value) {
        sb.append("<tr>");
        sb.append("<td style='padding: 8px 12px; font-weight: bold; color: #475569; width: 40%; vertical-align: top;'>").append(StringUtils.escapeHtml(label)).append("</td>");
        sb.append("<td style='padding: 8px 12px; color: #1e293b;'>").append(value != null ? StringUtils.escapeHtml(value) : "Non renseigné").append("</td>");
        sb.append("</tr>");
    }
}
