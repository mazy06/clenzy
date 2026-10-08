package com.clenzy.service.report.render;

/** Symbole statique Baitly approuvé, intégré aux rapports PDF. */
final class BaitlyMark {
    private static final String PATH = "M66 103.5 A8.5 8.5 0 1 1 66 86.5 A8.5 8.5 0 1 1 66 103.5 V126 Q66 140 52 140 H44 Q24 140 24 120 V69 Q24 62 30 58 L71 30 Q80 24 89 30 L130 58 Q136 62 136 69 V120 Q136 140 116 140 H108 Q94 140 94 126 V103.5 A8.5 8.5 0 1 1 94 86.5 A8.5 8.5 0 1 1 94 103.5";

    private BaitlyMark() {
    }

    /** Seul le trait maison est imprimé, sans flux de données. */
    static String svg(String stroke, int sizePt) {
        return String.format(java.util.Locale.ROOT,
                "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 160\" "
                + "width=\"%dpt\" height=\"%dpt\">"
                + "<path fill=\"none\" stroke=\"%s\" stroke-width=\"6.8\" stroke-linecap=\"round\" "
                + "stroke-linejoin=\"round\" d=\"%s\"/></svg>",
                sizePt, sizePt, stroke, PATH);
    }
}
