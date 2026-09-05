package com.clenzy.service.report.render;

/**
 * La feuille de style du document imprime.
 *
 * <p>Elle vit a part parce qu'elle est longue et qu'elle porte une decision de
 * marque, pas de la mecanique de rendu. Un PDF n'a pas de variables CSS : les
 * teintes y sont RESOLUES, et chaque valeur porte en commentaire le jeton dont
 * elle vient — sans quoi une retouche de la charte laisserait le document
 * imprime derriere elle, sans que rien ne le signale.</p>
 *
 * <p><b>Le parti pris.</b> Bleu nuit {@code #1B2A35} — la couleur du wordmark —
 * en aplat plein sur la couverture et en bandeau de chapitre ; famille TERRE
 * CUITE du planning ({@code #9A6C3A}, {@code #E0C89B}) en accent, parce que ce
 * sont les teintes que l'utilisateur voit toute la journee sur ses briques de
 * reservation. Le papier n'est jamais blanc pur, l'encre jamais noire.</p>
 *
 * <p>Les chapitres sont NUMEROTES et leurs titres poses sur un bandeau : c'est
 * ce qui distingue un document compose d'une suite de tableaux. La couverture
 * est en pleine page — d'ou la page nommee, seule facon d'annuler les marges
 * sur une page et pas sur les autres.</p>
 */
final class ReportTheme {

    private ReportTheme() {
    }

    /** {@code --bui-primary} — bleu nuit du wordmark. */
    static final String NIGHT = "#1B2A35";
    /** Fond de couverture, plus profond que l'encre pour que le texte s'en detache. */
    static final String NIGHT_DEEP = "#141F29";
    /** {@code --pl-st-confirmed} — l'accent terre cuite du planning. */
    static final String CLAY = "#9A6C3A";
    /** {@code --pl-st-pending} — le sable, pour les aplats doux. */
    static final String SAND = "#E0C89B";
    /** Sable tres dilue : fond des lignes de total et des cartes. */
    static final String SAND_WASH = "#F6EFE5";
    /** {@code --bui-card} — le papier, jamais blanc pur. */
    static final String PAPER = "#FBFCFD";
    /** {@code --bui-muted-foreground}. */
    static final String MUTED = "#5A6E7C";
    /** {@code --bui-border}. */
    static final String LINE = "#E2E8F0";
    /** Encre claire sur fond sombre. */
    static final String INK_LIGHT = "#F0EBE6";

    static String css() {
        return """
                /* ── Pages ──────────────────────────────────────────────────
                   La couverture est une page NOMMEE sans marge : c'est la seule
                   facon d'obtenir un aplat pleine page sans priver de marges
                   toutes les autres. */
                @page { size: A4; margin: 20mm 17mm 22mm 17mm; }
                @page cover { size: A4; margin: 0; }
                @page toc { size: A4; margin: 20mm 17mm 22mm 17mm; }

                body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt;
                       color: %NIGHT%; line-height: 1.5; margin: 0; }
                p { margin: 0 0 7pt; }

                /* ── Couverture ─────────────────────────────────────────────
                   Un aplat plein, une hierarchie typographique franche, et une
                   seule ligne d'accent. Rien d'autre : une couverture chargee
                   se lit comme une brochure, pas comme un document de gestion. */
                .cover { page-break-after: always; color: %INK_LIGHT%;
                         padding: 10mm 3mm 0 3mm; }
                .cover-mark { margin-bottom: 26pt; }
                .cover-issuer { font-size: 11pt; font-weight: bold; letter-spacing: 0.2em;
                                text-transform: uppercase; color: %SAND%; margin-bottom: 40pt; }
                .cover-issuer-logo { max-height: 52pt; max-width: 220pt; margin-bottom: 20pt; }
                .cover-kicker { font-size: 9pt; letter-spacing: 0.24em; text-transform: uppercase;
                                color: %CLAY%; margin-bottom: 10pt; }
                .cover h1 { font-size: 40pt; line-height: 1.05; margin: 0 0 18pt;
                            letter-spacing: -0.03em; font-weight: bold; color: %INK_LIGHT%; }
                .cover-rule { width: 90pt; height: 3pt; background: %CLAY%; margin-bottom: 22pt; }
                .cover-recipient { font-size: 15pt; color: %INK_LIGHT%; margin-bottom: 4pt; }
                .cover-period { font-size: 11pt; color: %SAND%; margin-bottom: 120pt; }
                .cover-kpis { width: 100%%; border-collapse: separate; border-spacing: 14pt 0;
                              margin: 0 -14pt 34pt; }
                .cover-kpis td { border-top: 2pt solid %CLAY%; padding: 9pt 0 0;
                                 vertical-align: top; width: 33%%; }
                .ck-label { font-size: 7.5pt; letter-spacing: 0.1em; text-transform: uppercase;
                            color: %SAND%; margin: 0 0 4pt; }
                .ck-value { font-size: 19pt; font-weight: bold; color: %INK_LIGHT%; margin: 0;
                            letter-spacing: -0.02em; }
                .cover-facts { width: 100%%; border-collapse: collapse; }
                .cover-facts td { padding: 7pt 0; border-top: 0.5pt solid rgba(240,235,230,0.18);
                                  font-size: 9pt; color: %SAND%; }
                .cover-facts .v { text-align: right; color: %INK_LIGHT%; font-weight: bold; }
                .cover-draft { display: inline-block; background: %CLAY%; color: %INK_LIGHT%;
                               font-size: 8.5pt; font-weight: bold; letter-spacing: 0.18em;
                               padding: 4pt 10pt; margin-bottom: 18pt; }

                /* ── Sommaire ───────────────────────────────────────────────── */
                .toc { page-break-after: always; }
                .toc-title { font-size: 22pt; font-weight: bold; letter-spacing: -0.02em;
                             margin: 0 0 4pt; }
                .toc-lead { color: %MUTED%; font-size: 9.5pt; margin-bottom: 20pt; }
                table.toc-list { width: 100%%; border-collapse: collapse; font-size: 10.5pt; }
                table.toc-list td { padding: 8pt 0; border-bottom: 0.5pt solid %LINE%;
                                    vertical-align: baseline; }
                .toc-num { width: 26pt; color: %CLAY%; font-weight: bold; font-size: 9pt; }
                .toc-page { width: 30pt; text-align: right; color: %MUTED%; font-weight: bold; }

                /* ── Chapitres ──────────────────────────────────────────────
                   Le bandeau et le numero font le rythme du document : sans eux,
                   vingt sections se suivent sans qu'on sache ou l'on est. */
                .chapter { page-break-inside: avoid; margin: 0 0 12pt; }
                .chapter-band { background: %NIGHT%; color: %INK_LIGHT%; padding: 9pt 12pt;
                                margin-bottom: 12pt; }
                .chapter-num { font-size: 8pt; letter-spacing: 0.2em; color: %SAND%;
                               margin: 0 0 2pt; }
                .chapter-title { font-size: 14pt; font-weight: bold; margin: 0;
                                 letter-spacing: -0.015em; }
                .chapter-sub { font-size: 8.5pt; color: %SAND%; margin: 2pt 0 0; }
                .section { margin-bottom: 18pt; }

                /* ── Chiffres cles ──────────────────────────────────────────── */
                .kpis { width: 100%%; border-collapse: separate; border-spacing: 6pt 0;
                        margin: 4pt 0 16pt; page-break-inside: avoid; }
                .kpi { background: %SAND_WASH%; padding: 11pt 10pt; vertical-align: top;
                       border-bottom: 2.5pt solid %CLAY%; }
                .kpi-label { font-size: 7.5pt; color: %MUTED%; text-transform: uppercase;
                             letter-spacing: 0.08em; margin: 0 0 5pt; }
                .kpi-value { font-size: 16pt; font-weight: bold; margin: 0 0 5pt;
                             letter-spacing: -0.02em; }
                .kpi-delta { font-size: 7pt; margin: 0; line-height: 1.6; color: %MUTED%; }
                .delta { font-weight: bold; }
                .delta.up { color: #0C7166; }
                .delta.down { color: #93413F; }
                .delta.flat { color: %MUTED%; }

                /* ── Commentaire et corps ───────────────────────────────────── */
                .narrative { background: %SAND_WASH%; border-left: 3pt solid %CLAY%;
                             padding: 9pt 12pt; margin: 0 0 14pt; font-size: 9.5pt; }
                .body-text { font-size: 9.5pt; color: #33454F; }
                .chart { margin: 6pt 0 14pt; }

                /* ── Tableaux ───────────────────────────────────────────────
                   Bandeau de tete plein et lignes alternees : la densite vient
                   du fond, pas d'un filet sur chaque bord. */
                table.data { width: 100%%; border-collapse: collapse; margin: 4pt 0 8pt;
                             font-size: 9pt; }
                /* En-tete CLAIRE, soulignee d'un filet plein. Un bandeau sombre
                   par tableau ferait trois aplats par page avec celui du
                   chapitre, et iText laisse de toute facon une couture d'un
                   pixel a la jointure de deux cellules peintes en aplat. */
                table.data th { background: %SAND_WASH%; color: %NIGHT%; text-align: left;
                                font-size: 7.5pt; text-transform: uppercase;
                                letter-spacing: 0.08em; padding: 7pt 8pt; font-weight: bold;
                                border-bottom: 1.2pt solid %NIGHT%; }
                table.data td { padding: 6pt 8pt; border-bottom: 0.4pt solid %LINE%; }
                table.data tr:nth-child(even) td { background: #F4F7F9; }
                table.data tfoot td { font-weight: bold; background: %SAND_WASH%;
                                      border-top: 1.5pt solid %CLAY%;
                                      border-bottom: 0.5pt solid %SAND_WASH%;
                                      border-left: 0.5pt solid %SAND_WASH%;
                                      border-right: 0.5pt solid %SAND_WASH%; padding: 8pt; }
                table.data .end { text-align: right; }
                table.data .center { text-align: center; }
                table.cascade tfoot td { font-size: 12pt; color: #4A2E1B; }

                /* ── Constats ───────────────────────────────────────────────── */
                table.notes { width: 100%%; border-collapse: collapse; margin: 10pt 0 0;
                              font-size: 9pt; }
                table.notes tr { page-break-inside: avoid; }
                table.notes td { padding: 7pt 9pt; background: #F4F7F9; vertical-align: top;
                                 border-bottom: 3pt solid %PAPER%; }
                .note-body { border-left: 3pt solid %LINE%; }
                .note-label { font-weight: bold; }
                .note-detail { color: %MUTED%; }
                .note-impact { text-align: right; font-weight: bold; width: 26%%;
                               white-space: nowrap; }
                tr.note-positive .note-body { border-left-color: #14B8A6; }
                tr.note-warning .note-body { border-left-color: %CLAY%; }
                tr.note-critical .note-body { border-left-color: #C97A7A; }
                .note-positive .note-label { color: #0C7166; }
                .note-warning .note-label { color: #7A5320; }
                .note-critical .note-label { color: #93413F; }

                /* ── Page « a propos » ──────────────────────────────────────── */
                .about { page-break-before: always; }
                .about-band { background: %NIGHT%; color: %INK_LIGHT%; padding: 20pt;
                              margin-bottom: 16pt; }
                .about-band h2 { font-size: 16pt; margin: 10pt 0 6pt; color: %INK_LIGHT%; }
                .about-band p { color: %SAND%; font-size: 9.5pt; margin: 0; }
                .annex-head { border-top: 2pt solid %CLAY%; padding: 8pt 0 0;
                              margin: 0 0 10pt; }
                .annex-head .chapter-title { color: %NIGHT%; }
                .annex-head .chapter-sub { color: %MUTED%; }
                .legal { font-size: 7pt; color: #8195A3; line-height: 1.6; text-align: justify; }
                .colophon { margin-top: 14pt; padding-top: 8pt; border-top: 1pt solid %NIGHT%;
                            font-size: 7.5pt; color: %MUTED%; }
                .ai-notice { font-style: italic; }
                """
                .replace("%NIGHT_DEEP%", NIGHT_DEEP)
                .replace("%NIGHT%", NIGHT)
                .replace("%CLAY%", CLAY)
                .replace("%SAND_WASH%", SAND_WASH)
                .replace("%SAND%", SAND)
                .replace("%PAPER%", PAPER)
                .replace("%MUTED%", MUTED)
                .replace("%LINE%", LINE)
                .replace("%INK_LIGHT%", INK_LIGHT)
                .replace("%%", "%");
    }
}
