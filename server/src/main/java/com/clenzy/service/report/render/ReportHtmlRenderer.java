package com.clenzy.service.report.render;

import com.clenzy.dto.report.*;
import com.clenzy.service.report.ReportFormats;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Met le snapshot en page.
 *
 * <p>Un seul gabarit produit le document imprime ; l'ecran rend le meme
 * snapshot avec les composants de l'interface. Les deux racontent la meme chose
 * parce qu'ils lisent la meme source, pas parce qu'on les tiendrait
 * synchronises a la main.</p>
 *
 * <p><b>La structure est celle d'un document, pas d'une suite de tableaux</b> :
 * couverture pleine page, sommaire pagine, chapitres numerotes sur bandeau,
 * puis une page « a propos » qui porte l'editeur, les definitions et les
 * mentions. C'est cette charpente qui fait qu'on sait ou l'on est page 12 —
 * sans elle, vingt sections se suivent et se ressemblent.</p>
 *
 * <p>Le CSS est integre et conservateur : iText ne connait ni flexbox ni grid.
 * Tout passe par des tableaux et des blocs, ce qui limite le vocabulaire mais
 * rend le resultat previsible — une page mal composee ne se rattrape pas.</p>
 */
@Component
public class ReportHtmlRenderer {

    private static final DateTimeFormatter STAMP =
            DateTimeFormatter.ofPattern("d MMMM yyyy 'à' HH'h'mm", Locale.FRANCE);

    /** Sections de service : elles ferment le document, elles n'ouvrent pas de chapitre. */
    private static final List<String> BACK_MATTER = List.of("glossary", "notice");

    private final SvgChartRenderer chartRenderer;
    private final ReportLogoResolver logoResolver;

    public ReportHtmlRenderer(SvgChartRenderer chartRenderer, ReportLogoResolver logoResolver) {
        this.chartRenderer = chartRenderer;
        this.logoResolver = logoResolver;
    }

    public String render(ReportSnapshot snapshot, ReportNarrative narrative, boolean draft) {
        return render(snapshot, narrative, draft, Map.of());
    }

    /**
     * Rend le document, avec les numeros de page du sommaire s'ils sont connus.
     *
     * @param pagesBySection page de chaque section, vide au premier passage —
     *                       un sommaire ne peut pas connaitre ses numeros avant
     *                       que la pagination existe (voir {@code ReportPdfService})
     */
    String render(ReportSnapshot snapshot, ReportNarrative narrative, boolean draft,
                  Map<String, Integer> pagesBySection) {
        final ReportMeta meta = snapshot.meta();
        final StringBuilder html = new StringBuilder(24_576);

        html.append("<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"UTF-8\"/><title>")
                .append(escape(meta.title())).append("</title><style>")
                .append(ReportTheme.css()).append("</style></head><body>");

        cover(html, meta, snapshot.kpis(), draft);

        final List<ReportSection> chapters = snapshot.sections().stream()
                .filter(section -> !BACK_MATTER.contains(section.id())).toList();
        final List<ReportSection> back = snapshot.sections().stream()
                .filter(section -> BACK_MATTER.contains(section.id())).toList();

        contents(html, chapters, pagesBySection);
        summary(html, snapshot, narrative);

        int index = 1;
        for (ReportSection section : chapters) {
            chapter(html, section, index++, narrative, meta);
        }

        about(html, meta, narrative, back);

        return html.append("</body></html>").toString();
    }

    /**
     * Les sections qui ouvrent un chapitre, dans l'ordre du document.
     *
     * <p>{@code ReportPdfService} en a besoin pour associer chaque numero de
     * chapitre lu dans le PDF de premiere passe a la section correspondante.</p>
     */
    List<String> chapterIds(ReportSnapshot snapshot) {
        return snapshot.sections().stream().map(ReportSection::id)
                .filter(id -> !BACK_MATTER.contains(id)).toList();
    }

    // ── Couverture ──────────────────────────────────────────────────────────

    private void cover(StringBuilder html, ReportMeta meta, List<ReportKpi> kpis,
                       boolean draft) {
        html.append("<div class=\"cover\">");
        html.append("<div class=\"cover-mark\">")
                .append(BaitlyMark.svg(ReportTheme.INK_LIGHT, 34)).append("</div>");

        if (draft) {
            html.append("<p class=\"cover-draft\">BROUILLON — NON DIFFUSABLE</p>");
        }

        // Le logo de l'emetteur REMPLACE son nom : les deux cote a cote font
        // doublon, et c'est le logo qui porte la marque.
        final String logo = logoResolver.resolve(meta.issuerLogoUrl()).orElse(null);
        if (logo != null) {
            html.append("<img class=\"cover-issuer-logo\" src=\"").append(logo).append("\" alt=\"\"/>");
        } else {
            html.append("<p class=\"cover-issuer\">").append(escape(meta.issuerName())).append("</p>");
        }

        html.append("<p class=\"cover-kicker\">").append(escape(kicker(meta.profile()))).append("</p>");
        html.append("<h1>").append(escape(meta.title())).append("</h1>");
        html.append("<div class=\"cover-rule\"></div>");
        if (meta.recipientName() != null) {
            html.append("<p class=\"cover-recipient\">").append(escape(meta.recipientName()))
                    .append("</p>");
        }
        html.append("<p class=\"cover-period\">")
                .append(escape(ReportFormats.period(meta.periodStart(), meta.periodEnd())))
                .append("</p>");

        coverKpis(html, kpis);

        html.append("<table class=\"cover-facts\">");
        fact(html, "Périmètre", meta.scopeLabels().size() + " bien(s)");
        fact(html, "Devise", meta.currency());
        fact(html, "Données arrêtées au",
                meta.dataAsOf().atZone(ZoneId.of("Europe/Paris")).format(STAMP));
        if (meta.documentNumber() != null) {
            fact(html, "Référence", meta.documentNumber() + " · version " + meta.version());
        }
        html.append("</table></div>");
    }

    /**
     * Les chiffres de la periode, sur la couverture.
     *
     * <p>Un releve de gestion se juge d'abord sur deux nombres. Les poser des la
     * page de titre evite au destinataire de chercher : la couverture informe au
     * lieu de seulement annoncer.</p>
     */
    private void coverKpis(StringBuilder html, List<ReportKpi> kpis) {
        if (kpis.isEmpty()) {
            return;
        }
        html.append("<table class=\"cover-kpis\"><tr>");
        for (ReportKpi kpi : kpis.stream().limit(3).toList()) {
            html.append("<td><p class=\"ck-label\">").append(escape(kpi.label()))
                    .append("</p><p class=\"ck-value\">").append(escape(kpi.value()))
                    .append("</p></td>");
        }
        html.append("</tr></table>");
    }

    /** La ligne de surtitre : elle dit a qui le document parle, avant son titre. */
    private String kicker(ReportProfile profile) {
        return switch (profile) {
            case OWNER -> "Rapport de gestion locative";
            case INTERNAL -> "Revue interne de portefeuille";
            case PROSPECT -> "Dossier de performance";
        };
    }

    private void fact(StringBuilder html, String label, String value) {
        html.append("<tr><td>").append(escape(label)).append("</td><td class=\"v\">")
                .append(escape(value)).append("</td></tr>");
    }

    // ── Sommaire ────────────────────────────────────────────────────────────

    /**
     * Le sommaire.
     *
     * <p>Sur vingt sections, sa presence n'est pas un ornement : sans lui, un
     * proprietaire qui cherche son compte de resultat feuillette. Les numeros de
     * page viennent d'un premier rendu — ils ne peuvent pas etre connus avant
     * que la pagination existe.</p>
     */
    private void contents(StringBuilder html, List<ReportSection> chapters,
                          Map<String, Integer> pagesBySection) {
        html.append("<div class=\"toc\"><p class=\"toc-title\">Sommaire</p>");
        html.append("<p class=\"toc-lead\">").append(chapters.size())
                .append(" sections, plus les définitions et la note de méthode en fin de document.</p>");
        html.append("<table class=\"toc-list\">");

        int index = 1;
        for (ReportSection section : chapters) {
            final Integer page = pagesBySection.get(section.id());
            html.append("<tr><td class=\"toc-num\">").append(String.format("%02d", index++))
                    .append("</td><td>").append(escape(section.title()))
                    .append("</td><td class=\"toc-page\">")
                    .append(page == null ? "" : String.valueOf(page))
                    .append("</td></tr>");
        }
        html.append("</table></div>");
    }

    // ── Synthese ────────────────────────────────────────────────────────────

    private void summary(StringBuilder html, ReportSnapshot snapshot, ReportNarrative narrative) {
        html.append("<div class=\"section\">");
        band(html, "Synthèse", "Les chiffres de la période, face à leurs deux références", null);

        html.append("<table class=\"kpis\"><tr>");
        for (ReportKpi kpi : snapshot.kpis()) {
            html.append("<td class=\"kpi\"><p class=\"kpi-label\">").append(escape(kpi.label()))
                    .append("</p><p class=\"kpi-value\">").append(escape(kpi.value())).append("</p>")
                    .append("<p class=\"kpi-delta\">")
                    .append(delta("période préc.", kpi.deltaPreviousPct(), kpi.higherIsBetter()))
                    .append(delta("an dernier", kpi.deltaLastYearPct(), kpi.higherIsBetter()))
                    .append("</p></td>");
        }
        html.append("</tr></table>");

        if (narrative != null && narrative.executiveSummary() != null) {
            html.append("<div class=\"narrative\"><p>")
                    .append(escape(narrative.executiveSummary()).replace("\n", "</p><p>"))
                    .append("</p></div>");
        }
        html.append("</div>");
    }

    private String delta(String label, java.math.BigDecimal value, boolean higherIsBetter) {
        if (value == null) {
            return "";
        }
        final boolean favourable = higherIsBetter ? value.signum() >= 0 : value.signum() <= 0;
        return "<span class=\"delta " + (value.signum() == 0 ? "flat" : favourable ? "up" : "down")
                + "\">" + escape(ReportFormats.signedPercent(value)) + "</span> " + escape(label)
                + "<br/>";
    }

    // ── Chapitres ───────────────────────────────────────────────────────────

    private void chapter(StringBuilder html, ReportSection section, int index,
                         ReportNarrative narrative, ReportMeta meta) {
        html.append("<div class=\"section\">");

        // Le bandeau voyage avec le graphique : iText ne sait pas honorer le
        // « keep-with-next » du CSS, mais il respecte `page-break-inside`.
        html.append("<div class=\"chapter\">");
        band(html, section.title(), section.subtitle(), index);

        final String comment = narrative == null ? null : narrative.sectionComments().get(section.id());
        if (comment != null) {
            html.append("<div class=\"narrative\"><p>").append(escape(comment)).append("</p></div>");
        }
        if (section.hasChart()) {
            html.append("<div class=\"chart\">")
                    .append(chartRenderer.render(section.chart(), meta.currency())).append("</div>");
        }
        html.append("</div>");

        if (section.hasTable()) {
            table(html, section);
        }
        if (section.body() != null) {
            html.append("<div class=\"body-text\"><p>")
                    .append(escape(section.body()).replace("\n\n", "</p><p>").replace("\n", " "))
                    .append("</p></div>");
        }
        notes(html, section.notes());
        html.append("</div>");
    }

    private void band(StringBuilder html, String title, String subtitle, Integer index) {
        band(html, title, subtitle, index, "chapter-band");
    }

    /** Le titre d'annexe : un filet, pas un aplat — voir {@code ReportTheme}. */
    private void annexHead(StringBuilder html, String title, String subtitle) {
        band(html, title, subtitle, null, "annex-head");
    }

    private void band(StringBuilder html, String title, String subtitle, Integer index,
                      String styleClass) {
        html.append("<div class=\"").append(styleClass).append("\">");
        if (index != null) {
            html.append("<p class=\"chapter-num\">CHAPITRE ")
                    .append(String.format("%02d", index)).append("</p>");
        }
        html.append("<p class=\"chapter-title\">").append(escape(title)).append("</p>");
        if (subtitle != null) {
            html.append("<p class=\"chapter-sub\">").append(escape(subtitle)).append("</p>");
        }
        html.append("</div>");
    }

    private void notes(StringBuilder html, List<ReportNote> notes) {
        if (notes.isEmpty()) {
            return;
        }
        // Un TABLEAU et non une liste a montant flottant : iText rend mal
        // `float: right`, et le montant s'y coupait a son separateur de milliers.
        html.append("<table class=\"notes\">");
        for (ReportNote note : notes) {
            html.append("<tr class=\"note-").append(escape(note.tone())).append("\">")
                    .append("<td class=\"note-body\"><span class=\"note-label\">")
                    .append(escape(note.label())).append("</span>");
            if (note.detail() != null) {
                html.append("<span class=\"note-detail\"> — ").append(escape(note.detail()))
                        .append("</span>");
            }
            html.append("</td><td class=\"note-impact\">");
            if (note.impact() != null) {
                html.append(escape(note.impact()));
            }
            html.append("</td></tr>");
        }
        html.append("</table>");
    }

    private void table(StringBuilder html, ReportSection section) {
        final ReportTable table = section.table();
        final boolean cascade = section.kind() == ReportSectionKind.PNL;
        html.append("<table class=\"data").append(cascade ? " cascade" : "").append("\"><thead><tr>");
        for (int i = 0; i < table.columns().size(); i++) {
            html.append("<th class=\"").append(alignOf(table, i)).append("\">")
                    .append(escape(table.columns().get(i))).append("</th>");
        }
        html.append("</tr></thead><tbody>");
        for (List<String> row : table.rows()) {
            html.append("<tr>");
            for (int i = 0; i < row.size(); i++) {
                html.append("<td class=\"").append(alignOf(table, i)).append("\">")
                        .append(escape(row.get(i))).append("</td>");
            }
            html.append("</tr>");
        }
        html.append("</tbody>");
        if (!table.totals().isEmpty()) {
            html.append("<tfoot><tr>");
            for (int i = 0; i < table.totals().size(); i++) {
                html.append("<td class=\"").append(alignOf(table, i)).append("\">")
                        .append(escape(table.totals().get(i))).append("</td>");
            }
            html.append("</tr></tfoot>");
        }
        html.append("</table>");
    }

    private String alignOf(ReportTable table, int index) {
        if (index >= table.aligns().size()) {
            return index == 0 ? "start" : "end";
        }
        return switch (table.aligns().get(index)) {
            case CENTER -> "center";
            case END -> "end";
            case START -> "start";
        };
    }

    // ── A propos ────────────────────────────────────────────────────────────

    /**
     * La page de fin : l'editeur, les definitions, la methode et les mentions.
     *
     * <p>Elle rassemble ce qu'on consulte APRES avoir lu — jamais avant. Placer
     * un glossaire au milieu du document coupe la lecture ; le mettre a la fin
     * le rend consultable sans le rendre encombrant.</p>
     */
    private void about(StringBuilder html, ReportMeta meta, ReportNarrative narrative,
                       List<ReportSection> back) {
        html.append("<div class=\"about\">");
        html.append("<div class=\"about-band\">")
                .append(BaitlyMark.svg(ReportTheme.INK_LIGHT, 30))
                .append("<h2>Produit avec Baitly</h2>")
                .append("<p>Baitly est la plateforme de gestion locative qui pilote les biens de ")
                .append(escape(meta.issuerName()))
                .append(" : calendriers, tarifs, interventions et comptes propriétaires. ")
                .append("Chaque chiffre de ce document provient directement des données ")
                .append("d'exploitation, sans ressaisie.</p>")
                .append("</div>");

        for (ReportSection section : back) {
            html.append("<div class=\"section\">");
            annexHead(html, section.title(), section.subtitle());
            if (section.hasTable()) {
                table(html, section);
            }
            if (section.body() != null) {
                html.append("<div class=\"body-text\"><p>")
                        .append(escape(section.body()).replace("\n\n", "</p><p>").replace("\n", " "))
                        .append("</p></div>");
            }
            notes(html, section.notes());
            html.append("</div>");
        }

        html.append("<div class=\"colophon\"><p>").append(escape(meta.issuerName())).append(" · ")
                .append(escape(ReportFormats.period(meta.periodStart(), meta.periodEnd())));
        if (meta.documentNumber() != null) {
            html.append(" · ").append(escape(meta.documentNumber())).append(" v").append(meta.version());
        }
        html.append("</p>");
        if (narrative != null && narrative.model() != null && !narrative.rejected()) {
            html.append("<p class=\"ai-notice\">Les commentaires de ce document ont été rédigés ")
                    .append("automatiquement à partir des chiffres présentés, puis relus. Modèle : ")
                    .append(escape(narrative.model())).append(".</p>");
        }
        html.append("<p class=\"legal\">Document établi par ").append(escape(meta.issuerName()))
                .append(" à partir des données de gestion arrêtées à la date indiquée. Les montants ")
                .append("sont exprimés en ").append(escape(meta.currency()))
                .append(" et présentés à titre informatif ; ils ne se substituent pas aux documents ")
                .append("comptables ni fiscaux. Les éléments prospectifs reposent sur les ")
                .append("réservations enregistrées à date et ne constituent ni un engagement ni une ")
                .append("garantie de résultat. Diffusion réservée à son destinataire.</p>");
        html.append("</div></div>");
    }

    /** Un nom de bien peut contenir « & » ou « < » : non echappe, il casse le document entier. */
    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
