package com.clenzy.service.report.render;

/**
 * Le mark Baitly, en SVG integrable au document.
 *
 * <p>Le trace vient de {@code client/src/assets/logo/baitly-mark.svg} : une
 * maison dessinee d'un seul trait continu, sur laquelle circulent deux paquets
 * — la requete et sa reponse. C'est l'identite animee du produit, figee.</p>
 *
 * <p>Les teintes du fichier source sont celles de l'ancienne charte
 * ({@code #6B8A9A}). Elles sont donc REDONNEES ici selon le fond : encre claire
 * sur la couverture bleu nuit, encre sombre sur le papier. Un logo imprime dans
 * une couleur que le produit n'emploie plus vieillit le document des sa
 * premiere page.</p>
 */
final class BaitlyMark {

    /** Le trace, identique aux trois couches : coque, paquet aller, paquet retour. */
    private static final String PATH =
            "M463 590.25 A30.25 30.25 0 0 1 463 529.75 A30.25 30.25 0 0 1 463 590.25 V710 "
            + "A30 30 0 0 1 433 740 H368 A65 65 0 0 1 303 675 V441.8 A28 28 0 0 1 313.9 419.6 "
            + "L478.2 294.1 A54 54 0 0 1 543.8 294.1 L708.1 419.6 A28 28 0 0 1 719 441.8 V675 "
            + "A65 65 0 0 1 654 740 H589 A30 30 0 0 1 559 710 V590.25 A30.25 30.25 0 0 1 559 529.75 "
            + "A30.25 30.25 0 0 1 559 590.25";

    private BaitlyMark() {
    }

    /**
     * Le mark, dimensionne en points.
     *
     * <p>Seule la coque est tracee. Les deux paquets du logo web reposent sur
     * {@code pathLength} avec un {@code stroke-dasharray}, que le moteur SVG
     * d'iText ne garantit pas : mal interprete, le motif devient un pointille
     * courant tout autour de la maison. Un logo faux vaut moins qu'un logo
     * sobre.</p>
     */
    static String svg(String stroke, int sizePt) {
        return String.format(java.util.Locale.ROOT,
                "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"251 251 522 522\" "
                + "width=\"%dpt\" height=\"%dpt\">"
                + "<path fill=\"none\" stroke=\"%s\" stroke-width=\"24\" stroke-linecap=\"round\" "
                + "stroke-linejoin=\"round\" d=\"%s\"/></svg>",
                sizePt, sizePt, stroke, PATH);
    }
}
