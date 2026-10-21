package com.clenzy.service.report.render;

/** Resolved Baitly document palette: quiet structure, teal finance, ochre operations. */
final class ReportTheme {
    private ReportTheme() {}
    static final String NIGHT = "#1B2A35";
    static final String PAPER = "#FBFCFD";
    static final String TEAL_INK = "#0C7166";
    static final String MUTED = "#526879";
    static final String LINE = "#DCE5ED";

    static String css() {
        return """
                @page { size: A4; margin: 20mm 17mm 22mm; }
                body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt;
                       color: #1B2A35; background: #FBFCFD; line-height: 1.5; margin: 0; }
                * { box-sizing: border-box; }
                p { margin: 0 0 7pt; orphans: 3; widows: 3; }
                h1,h2,h3 { font-family: Arial, Helvetica, sans-serif; }
                .cover { page-break-after: always; padding: 8mm 0 0; }
                .cover-mark { margin-bottom: 22pt; }
                .cover-issuer { font-size: 10pt; font-weight: bold; letter-spacing: .12em;
                                text-transform: uppercase; color: #526879; margin-bottom: 34pt; }
                .cover-issuer-logo { max-height: 52pt; max-width: 220pt; margin-bottom: 24pt; }
                .cover-kicker { display: inline-block; font-size: 9pt; color: #526879;
                                background: #EEF3F7; padding: 5pt 9pt; margin-bottom: 14pt; }
                .profile-internal .cover-kicker { color: #0C7166; background: #E1F2EE; }
                .profile-prospect .cover-kicker { color: #7A5320; background: #F6EFE5; }
                .cover h1 { font-size: 30pt; line-height: 1.15; margin: 0 0 20pt;
                            font-weight: bold; color: #1B2A35; letter-spacing: -.5pt; }
                .cover-rule { height: .6pt; background: #DCE5ED; margin-bottom: 20pt; }
                .cover-recipient { font-size: 15pt; margin-bottom: 6pt; }
                .cover-period { font-size: 12pt; color: #526879; margin-bottom: 48pt; }
                .cover-draft { display: inline-block; background: #F6EFE5; color: #7A5320;
                               font-size: 8pt; font-weight: bold; padding: 5pt 9pt; margin-bottom: 16pt; }
                .cover-kpis { width: 100%; border-collapse: separate; border-spacing: 8pt 0;
                              margin: 0 0 26pt; table-layout: fixed; }
                .cover-kpis td { background: #E1F2EE; padding: 12pt; vertical-align: top; }
                .ck-label { font-size: 8.5pt; color: #0C7166; margin: 0 0 7pt; }
                .ck-value { font-size: 18pt; font-weight: bold; color: #1B2A35; margin: 0; }
                .cover-facts { width: 100%; border-collapse: collapse; font-size: 9pt; }
                .cover-facts td { padding: 9pt 0; border-bottom: .5pt solid #DCE5ED; color: #526879; }
                .cover-facts .v { text-align: right; color: #1B2A35; }
                .cover-scope { font-size: 9pt; color: #526879; line-height: 1.5; margin-top: 12pt; }
                .toc { page-break-after: always; }
                .toc-title { font-size: 24pt; font-weight: bold; margin: 0 0 8pt; }
                .toc-lead { color: #526879; font-size: 10pt; margin-bottom: 22pt; }
                .toc-list { width: 100%; border-collapse: collapse; font-size: 10pt; }
                .toc-list td { padding: 8pt 0; border-bottom: .5pt solid #DCE5ED; }
                .toc-num { width: 28pt; color: #526879; }
                .toc-page { width: 30pt; text-align: right; color: #526879; }
                .section { display: flow-root; margin-bottom: 22pt; page-break-inside: avoid; break-inside: avoid-page; }
                .section-details { page-break-inside: avoid; }
                .chapter { page-break-inside: avoid; margin-bottom: 12pt; }
                .chapter-band { background: #EEF3F7; padding: 12pt; margin-bottom: 14pt; border-radius: 5pt; }
                .chapter-num { color: #526879; font-size: 8pt; letter-spacing: .08em; margin: 0 0 5pt; }
                .chapter-title { font-size: 16pt; font-weight: bold; line-height: 1.3; margin: 0; color: #1B2A35; }
                .chapter-sub { font-size: 9pt; color: #526879; margin: 5pt 0 0; }
                .tone-activity .chapter-band { background: #EDF2F7; }
                .tone-money .chapter-band { background: #E1F2EE; }
                .tone-money .chapter-num { color: #0C7166; }
                .tone-operations .chapter-band { background: #F6EFE5; }
                .tone-operations .chapter-num { color: #7A5320; }
                .kpis { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 8pt 8pt;
                        margin: 4pt 0 14pt; }
                .kpi { padding: 10pt; vertical-align: top; background: #F4F7F9; }
                .kpi-label { font-size: 9pt; color: #526879; margin: 0 0 6pt; }
                .kpi-value { font-size: 18pt; font-weight: bold; margin: 0 0 6pt; }
                .kpi-delta { font-size: 8pt; margin: 0; line-height: 1.7; color: #526879; }
                .delta { font-weight: bold; }
                .delta.up { color: #0C7166; }
                .delta.down { color: #93413F; }
                .delta.flat { color: #526879; }
                .narrative { background: #E1F2EE; border-radius: 5pt; padding: 12pt;
                             margin: 0 0 16pt; font-size: 10pt; }
                .narrative p:last-child { margin-bottom: 0; }
                .body-text { font-size: 10pt; color: #33454F; }
                .chart { margin: 8pt 0 16pt; }
                table.data { width: 100%; border-collapse: collapse; margin: 4pt 0 10pt; font-size: 9pt; }
                table.data thead { display: table-header-group; }
                table.data tr { page-break-inside: avoid; }
                table.data th { background: #EEF3F7; color: #526879; text-align: left;
                                font-size: 8.5pt; padding: 9pt 8pt; font-weight: bold; }
                table.data td { padding: 8pt; border-bottom: .5pt solid #DCE5ED; vertical-align: top; }
                table.data tr:nth-child(even) td { background: #F4F7F9; }
                table.data tfoot td { font-weight: bold; background: #EEF3F7; border-top: .6pt solid #DCE5ED; padding: 10pt 8pt; }
                .tone-money table.data th, .tone-money table.data tfoot td { background: #E1F2EE; color: #0C7166; }
                .tone-operations table.data th, .tone-operations table.data tfoot td { background: #F6EFE5; color: #7A5320; }
                table.data .end { text-align: right; }
                table.data .center { text-align: center; }
                table.cascade tfoot td { font-size: 12pt; }
                table.notes { width: 100%; border-collapse: collapse; margin: 10pt 0 0; font-size: 9pt; }
                table.notes tr { page-break-inside: avoid; }
                table.notes td { padding: 10pt 8pt; vertical-align: top; border-bottom: .5pt solid #DCE5ED; }
                .note-label { font-weight: bold; }
                .note-detail { color: #526879; }
                .note-impact { text-align: right; font-weight: bold; width: 26%; white-space: nowrap; }
                .note-positive .note-impact { color: #0C7166; }
                .note-warning .note-impact { color: #7A5320; }
                .note-critical .note-impact { color: #93413F; }
                .about { page-break-before: always; }
                .about-band { background: #EEF3F7; padding: 20pt; margin-bottom: 20pt; border-radius: 5pt; }
                .about-band h2 { font-size: 18pt; margin: 12pt 0 8pt; }
                .about-band p { color: #526879; font-size: 10pt; margin: 0; }
                .annex-head { padding: 12pt 0 0; margin: 0 0 14pt; border-top: .6pt solid #DCE5ED; }
                .legal { font-size: 8pt; color: #526879; line-height: 1.6; }
                .colophon { margin-top: 18pt; padding-top: 10pt; border-top: .6pt solid #DCE5ED; font-size: 8.5pt; color: #526879; }
                .ai-notice { font-style: italic; }
                """;
    }
}
