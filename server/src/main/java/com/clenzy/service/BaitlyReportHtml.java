package com.clenzy.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/** Présentation des agrégats existants ; aucun calcul métier supplémentaire dans le rendu. */
final class BaitlyReportHtml {
    private BaitlyReportHtml() {}
    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("totalRevenue", "Revenus Totaux"), Map.entry("totalCosts", "Coûts Totaux"),
            Map.entry("interventionsCount", "Nombre d'interventions"), Map.entry("revenue", "Revenus"),
            Map.entry("costs", "Coûts"), Map.entry("profit", "Profit Net"),
            Map.entry("completionRate", "Taux de Complétion"), Map.entry("completed", "Complétées"),
            Map.entry("total", "Total"), Map.entry("scheduled", "Planifiées"),
            Map.entry("teamsCount", "Nombre d'Équipes"), Map.entry("totalMembers", "Total de membres"),
            Map.entry("active", "Actives"), Map.entry("propertiesCount", "Nombre de Propriétés"));

    static String render(String issuer, String title, LocalDate from, LocalDate to, Map<String, Object> data) {
        StringBuilder body = new StringBuilder("<header><p>").append(BaitlyDocumentHtml.escape(issuer))
                .append("</p><h1>").append(BaitlyDocumentHtml.escape(title))
                .append("</h1></header>").append(BaitlyDocumentHtml.paragraph("Période : " + PdfTemplateHelper.formatDate(from) + " - " + PdfTemplateHelper.formatDate(to)))
                .append("<h2>Synthèse</h2><table><tbody>");
        data.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(entry -> {
            Object value = entry.getValue();
            String formatted = value instanceof BigDecimal amount ? PdfTemplateHelper.formatCurrency(amount)
                    : entry.getKey().equals("completionRate") ? PdfTemplateHelper.formatPercentage(((Number) value).doubleValue()) : String.valueOf(value);
            body.append(BaitlyDocumentHtml.row(LABELS.getOrDefault(entry.getKey(), entry.getKey()), formatted));
        });
        body.append("</tbody></table><footer>Document généré par Baitly</footer>");
        return BaitlyDocumentHtml.page(issuer + " · " + title, body.toString());
    }
}
