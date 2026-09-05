package com.clenzy.service.report.render;

import com.clenzy.dto.report.ReportChart;
import com.clenzy.dto.report.ReportSeries;
import com.clenzy.service.report.ReportFormats;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Trace les graphiques du rapport en SVG, cote serveur.
 *
 * <p><b>Pourquoi cote serveur.</b> Un rapport doit pouvoir naitre sans
 * navigateur : le planificateur mensuel et l'agent en produisent, et ni l'un ni
 * l'autre n'a de DOM. Faire fabriquer les images par le front interdirait
 * l'envoi automatique du releve du 1er du mois — c'est-a-dire l'usage
 * principal.</p>
 *
 * <p>Le SVG est integre tel quel dans le HTML converti par iText (module SVG
 * inclus dans itext7-core). Les couleurs sont des HEXADECIMAUX resolus : un PDF
 * n'a pas de variables CSS, et une teinte non resolue s'y rendrait en noir.</p>
 */
@Component
public class SvgChartRenderer {

    /**
     * L'identite visuelle de Baitly, en dur.
     *
     * <p>Un PDF n'a pas de variables CSS : chaque teinte doit y etre resolue.
     * Ces valeurs sont donc RECOPIEES de leur source, et le commentaire dit
     * laquelle — sans quoi une retouche de la charte laisserait le document
     * imprime derriere elle, sans que rien ne le signale.</p>
     *
     * <p>La serie suit la famille TERRE CUITE des briques de reservation du
     * planning ({@code planningUrgency.css}), ouverte par le bleu nuit du
     * wordmark ({@code --bui-primary}). Ce ne sont pas des teintes decoratives :
     * ce sont celles que l'utilisateur voit toute la journee sur son planning,
     * et un rapport qui en emploierait d'autres se lirait comme un document
     * etranger au produit.</p>
     */
    private static final String[] SERIES = {
        "#1B2A35", // --bui-primary — bleu nuit du wordmark
        "#9A6C3A", // --pl-st-confirmed — brun median
        "#E0C89B", // --pl-st-pending — beige, le plus pale
        "#A89684", // --pl-st-checked-out — taupe desature
        "#5C3A21", // --pl-st-checked-in — brun dense
    };

    /** {@code --bui-foreground} : l'encre du document. */
    private static final String INK = "#1B2A35";
    /** {@code --bui-muted-foreground} : graduations et legendes. */
    private static final String MUTED = "#5A6E7C";
    /** {@code --bui-border} : filets et grilles. */
    private static final String LINE = "#E2E8F0";

    private static final int WIDTH = 720;
    private static final int HEIGHT = 232;
    private static final int PAD_LEFT = 64;
    private static final int PAD_RIGHT = 16;
    private static final int PAD_TOP = 16;
    private static final int PAD_BOTTOM = 46;

    /**
     * Largeur de la colonne de texte, en points PDF.
     *
     * <p>A4 (595 pt) moins les marges de 16 mm de la feuille de style. Le SVG
     * doit porter une hauteur ABSOLUE : avec {@code width="100%"} et aucune
     * hauteur, iText lui alloue toute la page restante et colle le dessin en
     * bas — un graphique de 260 unites occupait une page entiere, precedee de
     * 600 pt de blanc. Le document faisait douze pages pour deux mois de
     * donnees.</p>
     */
    private static final double COLUMN_PT = 504;

    /** Ouverture d'un SVG dimensionne en points, au ratio de sa zone de dessin. */
    private static String svgOpen(int viewWidth, int viewHeight) {
        return String.format(Locale.ROOT,
                // Unite EXPLICITE : un `width="504"` nu est lu en pixels CSS,
                // soit 378 pt — le graphique n'occupait que les trois quarts de
                // la colonne, et rien ne le signalait.
                "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 %d %d\" "
                + "width=\"%.0fpt\" height=\"%.0fpt\" font-family=\"Helvetica, Arial, sans-serif\">",
                viewWidth, viewHeight, COLUMN_PT, COLUMN_PT * viewHeight / (double) viewWidth);
    }

    public String render(ReportChart chart, String currency) {
        if (chart == null || chart.isEmpty()) {
            return "";
        }
        return switch (chart.type()) {
            case DONUT -> donut(chart, currency);
            case HORIZONTAL_BARS -> horizontalBars(chart, currency);
            case LINES, AREA -> lines(chart, currency, chart.type() == com.clenzy.dto.report.ReportChartType.AREA);
            case BARS, STACKED_BARS -> bars(chart, currency, chart.type() == com.clenzy.dto.report.ReportChartType.STACKED_BARS);
        };
    }

    // ── Barres verticales ───────────────────────────────────────────────────

    private String bars(ReportChart chart, String currency, boolean stacked) {
        final int plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
        final int plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
        final int categories = chart.categories().size();
        if (categories == 0) {
            return "";
        }

        final double max = stacked ? maxStacked(chart) : maxValue(chart);
        final StringBuilder svg = open();
        grid(svg, max, chart.valueUnit(), currency, plotWidth, plotHeight);

        final double slot = (double) plotWidth / categories;
        final int seriesCount = chart.series().size();
        final double barWidth = stacked
                ? Math.min(34, slot * 0.55)
                : Math.min(26, (slot * 0.7) / Math.max(1, seriesCount));

        for (int c = 0; c < categories; c++) {
            final double centre = PAD_LEFT + slot * (c + 0.5);
            double stackBase = 0;
            for (int s = 0; s < seriesCount; s++) {
                final BigDecimal raw = valueAt(chart.series().get(s), c);
                if (raw == null) {
                    continue;
                }
                final double value = raw.doubleValue();
                final double height = max <= 0 ? 0 : (Math.abs(value) / max) * plotHeight;
                final double x = stacked
                        ? centre - barWidth / 2
                        : centre - (barWidth * seriesCount) / 2 + s * barWidth;
                final double y = stacked
                        ? PAD_TOP + plotHeight - height - (stackBase / max) * plotHeight
                        : PAD_TOP + plotHeight - height;
                svg.append(String.format(Locale.ROOT,
                        "<rect x=\"%.1f\" y=\"%.1f\" width=\"%.1f\" height=\"%.1f\" rx=\"2\" fill=\"%s\"/>",
                        x, y, Math.max(1, barWidth - (stacked ? 0 : 2)), Math.max(0.5, height),
                        colorOf(chart.series().get(s), s)));
                if (stacked) {
                    stackBase += Math.abs(value);
                }
            }
            categoryLabel(svg, chart.categories().get(c), centre, categories);
        }

        legend(svg, chart);
        return svg.append("</svg>").toString();
    }

    // ── Barres horizontales ─────────────────────────────────────────────────

    private String horizontalBars(ReportChart chart, String currency) {
        final int categories = chart.categories().size();
        if (categories == 0) {
            return "";
        }
        // Une barre par bien : la hauteur suit le nombre de lignes, sans quoi
        // dix logements se tassent en bandes de trois pixels.
        final int rowHeight = 22;
        final int height = PAD_TOP + categories * rowHeight + 28;
        final int labelWidth = 150;
        final int plotWidth = WIDTH - labelWidth - PAD_RIGHT - 40;
        final double max = maxValue(chart);
        final ReportSeries series = chart.series().get(0);

        final StringBuilder svg = new StringBuilder(svgOpen(WIDTH, height));

        for (int c = 0; c < categories; c++) {
            final BigDecimal raw = valueAt(series, c);
            final double value = raw == null ? 0 : raw.doubleValue();
            final double barWidth = max <= 0 ? 0 : (Math.abs(value) / max) * plotWidth;
            final double y = PAD_TOP + c * rowHeight;
            svg.append(String.format(Locale.ROOT,
                    "<text x=\"%d\" y=\"%.1f\" font-size=\"10\" fill=\"%s\" text-anchor=\"end\">%s</text>",
                    labelWidth - 8, y + 12, MUTED, escape(clip(chart.categories().get(c), 24))));
            svg.append(String.format(Locale.ROOT,
                    "<rect x=\"%d\" y=\"%.1f\" width=\"%.1f\" height=\"12\" rx=\"2\" fill=\"%s\"/>",
                    labelWidth, y + 3, Math.max(1, barWidth), SERIES[1]));
            svg.append(String.format(Locale.ROOT,
                    "<text x=\"%.1f\" y=\"%.1f\" font-size=\"9\" fill=\"%s\">%s</text>",
                    labelWidth + barWidth + 6, y + 13, MUTED, escape(format(raw, chart.valueUnit(), currency))));
        }
        return svg.append("</svg>").toString();
    }

    // ── Courbes et aires ────────────────────────────────────────────────────

    private String lines(ReportChart chart, String currency, boolean filled) {
        final int plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
        final int plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
        final int categories = chart.categories().size();
        if (categories == 0) {
            return "";
        }
        final double max = maxValue(chart);
        final StringBuilder svg = open();
        grid(svg, max, chart.valueUnit(), currency, plotWidth, plotHeight);

        final double step = categories == 1 ? 0 : (double) plotWidth / (categories - 1);
        for (int s = 0; s < chart.series().size(); s++) {
            final ReportSeries series = chart.series().get(s);
            final String color = colorOf(series, s);
            final List<String> points = new ArrayList<>();
            for (int c = 0; c < categories; c++) {
                final BigDecimal raw = valueAt(series, c);
                if (raw == null) {
                    continue;
                }
                final double x = PAD_LEFT + step * c;
                final double y = PAD_TOP + plotHeight - (max <= 0 ? 0 : (raw.doubleValue() / max) * plotHeight);
                points.add(String.format(Locale.ROOT, "%.1f,%.1f", x, y));
            }
            if (points.isEmpty()) {
                continue;
            }
            if (filled) {
                svg.append(String.format(Locale.ROOT,
                        "<polygon points=\"%.1f,%.1f %s %.1f,%.1f\" fill=\"%s\" fill-opacity=\"0.18\"/>",
                        (double) PAD_LEFT, (double) PAD_TOP + plotHeight, String.join(" ", points),
                        PAD_LEFT + step * (categories - 1), (double) PAD_TOP + plotHeight, color));
            }
            svg.append(String.format(Locale.ROOT,
                    "<polyline points=\"%s\" fill=\"none\" stroke=\"%s\" stroke-width=\"2\"%s/>",
                    String.join(" ", points), color,
                    series.dashed() ? " stroke-dasharray=\"5 3\"" : ""));
        }

        for (int c = 0; c < categories; c++) {
            categoryLabel(svg, chart.categories().get(c), PAD_LEFT + step * c, categories);
        }
        legend(svg, chart);
        return svg.append("</svg>").toString();
    }

    // ── Anneau ──────────────────────────────────────────────────────────────

    private String donut(ReportChart chart, String currency) {
        final ReportSeries series = chart.series().get(0);
        double total = 0;
        for (BigDecimal value : series.values()) {
            if (value != null && value.signum() > 0) {
                total += value.doubleValue();
            }
        }
        if (total <= 0) {
            return "";
        }

        final double cx = 130;
        final double cy = 130;
        final double outer = 96;
        final double inner = 60;
        final StringBuilder svg = new StringBuilder(svgOpen(720, 268));

        double angle = -Math.PI / 2;
        int index = 0;
        for (int c = 0; c < chart.categories().size(); c++) {
            final BigDecimal raw = valueAt(series, c);
            if (raw == null || raw.signum() <= 0) {
                continue;
            }
            final double sweep = (raw.doubleValue() / total) * 2 * Math.PI;
            svg.append(arc(cx, cy, inner, outer, angle, angle + sweep, SERIES[index % SERIES.length]));

            final double legendY = 40 + index * 22;
            svg.append(String.format(Locale.ROOT,
                    "<rect x=\"280\" y=\"%.1f\" width=\"9\" height=\"9\" rx=\"2\" fill=\"%s\"/>",
                    legendY, SERIES[index % SERIES.length]));
            svg.append(String.format(Locale.ROOT,
                    "<text x=\"296\" y=\"%.1f\" font-size=\"11\" fill=\"%s\">%s</text>",
                    legendY + 9, INK, escape(clip(chart.categories().get(c), 22))));
            svg.append(String.format(Locale.ROOT,
                    "<text x=\"560\" y=\"%.1f\" font-size=\"11\" fill=\"%s\" text-anchor=\"end\">%s</text>",
                    legendY + 9, INK, escape(format(raw, chart.valueUnit(), currency))));
            svg.append(String.format(Locale.ROOT,
                    "<text x=\"620\" y=\"%.1f\" font-size=\"11\" fill=\"%s\" text-anchor=\"end\">%s</text>",
                    legendY + 9, MUTED, Math.round((raw.doubleValue() / total) * 100) + " %"));

            angle += sweep;
            index++;
        }

        svg.append(String.format(Locale.ROOT,
                "<text x=\"%.0f\" y=\"%.0f\" font-size=\"18\" font-weight=\"bold\" fill=\"%s\" "
                + "text-anchor=\"middle\">%s</text>", cx, cy + 6, INK,
                escape(ReportFormats.moneyCompact(BigDecimal.valueOf(total), currency))));
        return svg.append("</svg>").toString();
    }

    /** Secteur d'anneau, en deux arcs et deux segments — iText ne connait pas `stroke-dasharray` circulaire. */
    private String arc(double cx, double cy, double inner, double outer, double start, double end, String fill) {
        final int large = (end - start) > Math.PI ? 1 : 0;
        final double x1 = cx + outer * Math.cos(start);
        final double y1 = cy + outer * Math.sin(start);
        final double x2 = cx + outer * Math.cos(end);
        final double y2 = cy + outer * Math.sin(end);
        final double x3 = cx + inner * Math.cos(end);
        final double y3 = cy + inner * Math.sin(end);
        final double x4 = cx + inner * Math.cos(start);
        final double y4 = cy + inner * Math.sin(start);
        return String.format(Locale.ROOT,
                "<path d=\"M %.2f %.2f A %.2f %.2f 0 %d 1 %.2f %.2f L %.2f %.2f A %.2f %.2f 0 %d 0 %.2f %.2f Z\" "
                + "fill=\"%s\"/>",
                x1, y1, outer, outer, large, x2, y2, x3, y3, inner, inner, large, x4, y4, fill);
    }

    // ── Decor commun ────────────────────────────────────────────────────────

    private StringBuilder open() {
        return new StringBuilder(svgOpen(WIDTH, HEIGHT));
    }

    /** Quatre graduations : au-dela, la grille encombre plus qu'elle n'aide. */
    private void grid(StringBuilder svg, double max, String unit, String currency,
                      int plotWidth, int plotHeight) {
        for (int i = 0; i <= 4; i++) {
            final double y = PAD_TOP + plotHeight - (plotHeight / 4.0) * i;
            svg.append(String.format(Locale.ROOT,
                    "<line x1=\"%d\" y1=\"%.1f\" x2=\"%d\" y2=\"%.1f\" stroke=\"%s\" stroke-width=\"1\"/>",
                    PAD_LEFT, y, PAD_LEFT + plotWidth, y, LINE));
            final BigDecimal tick = BigDecimal.valueOf(max / 4 * i).setScale(2, RoundingMode.HALF_UP);
            svg.append(String.format(Locale.ROOT,
                    "<text x=\"%d\" y=\"%.1f\" font-size=\"9\" fill=\"%s\" text-anchor=\"end\">%s</text>",
                    PAD_LEFT - 8, y + 3, MUTED, escape(axisLabel(tick, unit, currency))));
        }
    }

    /**
     * Libelle d'abscisse, eclairci quand les categories se serrent.
     *
     * <p>Au-dela d'une dizaine de colonnes, les libelles se chevauchent : on
     * n'en garde qu'un sur deux. Un axe illisible n'informe pas plus qu'un axe
     * absent.</p>
     */
    private void categoryLabel(StringBuilder svg, String label, double x, int categories) {
        final int stride = categories > 10 ? 2 : 1;
        final int position = (int) Math.round((x - PAD_LEFT) / Math.max(1, (WIDTH - PAD_LEFT - PAD_RIGHT)
                / (double) Math.max(1, categories)));
        if (stride > 1 && position % stride != 0) {
            return;
        }
        svg.append(String.format(Locale.ROOT,
                "<text x=\"%.1f\" y=\"%d\" font-size=\"9\" fill=\"%s\" text-anchor=\"middle\">%s</text>",
                x, HEIGHT - PAD_BOTTOM + 18, MUTED, escape(clip(label, 12))));
    }

    private void legend(StringBuilder svg, ReportChart chart) {
        if (chart.series().size() < 2) {
            return;
        }
        double x = PAD_LEFT;
        for (int s = 0; s < chart.series().size(); s++) {
            final ReportSeries series = chart.series().get(s);
            svg.append(String.format(Locale.ROOT,
                    "<rect x=\"%.1f\" y=\"%d\" width=\"9\" height=\"9\" rx=\"2\" fill=\"%s\"/>",
                    x, HEIGHT - 16, colorOf(series, s)));
            svg.append(String.format(Locale.ROOT,
                    "<text x=\"%.1f\" y=\"%d\" font-size=\"10\" fill=\"%s\">%s</text>",
                    x + 14, HEIGHT - 8, MUTED, escape(series.label())));
            x += 20 + series.label().length() * 5.6;
        }
    }

    // ── Valeurs ─────────────────────────────────────────────────────────────

    private static BigDecimal valueAt(ReportSeries series, int index) {
        return index < series.values().size() ? series.values().get(index) : null;
    }

    private double maxValue(ReportChart chart) {
        double max = 0;
        for (ReportSeries series : chart.series()) {
            for (BigDecimal value : series.values()) {
                if (value != null) {
                    max = Math.max(max, Math.abs(value.doubleValue()));
                }
            }
        }
        return max == 0 ? 1 : max;
    }

    private double maxStacked(ReportChart chart) {
        double max = 0;
        final int categories = chart.categories().size();
        for (int c = 0; c < categories; c++) {
            double sum = 0;
            for (ReportSeries series : chart.series()) {
                final BigDecimal value = valueAt(series, c);
                if (value != null) {
                    sum += Math.abs(value.doubleValue());
                }
            }
            max = Math.max(max, sum);
        }
        return max == 0 ? 1 : max;
    }

    private String colorOf(ReportSeries series, int index) {
        if (series.tone() == null) {
            return SERIES[index % SERIES.length];
        }
        // Teintes semantiques de la charte (`--bui-*`), resolues.
        return switch (series.tone()) {
            case "success" -> "#14B8A6";
            case "warning" -> "#D4A574";
            case "destructive" -> "#C97A7A";
            case "neutral" -> "#94A7B8";
            case "primary" -> "#1B2A35";
            default -> SERIES[index % SERIES.length];
        };
    }

    private String axisLabel(BigDecimal value, String unit, String currency) {
        return "money".equals(unit) ? ReportFormats.moneyCompact(value, currency) : format(value, unit, currency);
    }

    private String format(BigDecimal value, String unit, String currency) {
        if (value == null) {
            return "—";
        }
        return switch (unit == null ? "count" : unit) {
            case "money" -> ReportFormats.money(value, currency);
            case "percent" -> ReportFormats.percent(value);
            default -> ReportFormats.count(value.longValue());
        };
    }

    private static String clip(String value, int max) {
        return value != null && value.length() > max ? value.substring(0, max - 1) + "…" : String.valueOf(value);
    }

    /**
     * Echappe et assainit tout texte pose dans le SVG.
     *
     * <p>Un nom de bien peut contenir « & » ou « < » : non echappe, le SVG casse
     * le PDF entier.</p>
     *
     * <p>Les separateurs de milliers du francais sont des espaces insecables
     * ETROITES (U+202F depuis Java 9) : la police Helvetica du moteur SVG n'a pas
     * ce glyphe et le laisse tomber en silence — « 12 677 » s'imprime « 12677 ».
     * On les ramene donc a l'espace ordinaire, ici et nulle part ailleurs :
     * l'ecran, lui, rend l'espace fine correctement.</p>
     */
    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\u202F', ' ').replace('\u00A0', ' ')
                .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
