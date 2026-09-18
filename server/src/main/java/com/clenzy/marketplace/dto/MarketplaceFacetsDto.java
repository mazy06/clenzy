package com.clenzy.marketplace.dto;

import java.util.List;

/**
 * Volumes du catalogue, par dimension de filtre.
 *
 * <h2>Pourquoi ces chiffres existent</h2>
 * <p>Sans eux, l'ecran proposait a egalite « Menage », qui compte vingt-neuf
 * professionnels, et « Energie &amp; connectivite », qui n'en compte aucun —
 * vingt-neuf metiers sur trente-deux ne renvoyaient rien. Le compteur transforme
 * une liste de possibilites en carte du terrain : on voit ou il y a du monde
 * AVANT de cliquer, au lieu de le decouvrir sur un ecran vide.</p>
 *
 * <h2>Portee des comptes</h2>
 * <p>Ils decrivent <b>l'ensemble du catalogue</b>, pas le sous-ensemble filtre.
 * C'est deliberé : leur role est de dire ou chercher, et des comptes qui
 * tomberaient a zero au fur et a mesure du filtrage cacheraient justement les
 * pistes vers lesquelles se rabattre. L'interface le dit explicitement.</p>
 *
 * @param categories  par code de metier
 * @param services    par code de prestation du catalogue
 * @param cities      par ville de zone declaree
 * @param statuses    par etat de fiche
 * @param engagements par mode d'engagement
 */
public record MarketplaceFacetsDto(
    List<FacetCount> categories,
    List<FacetCount> services,
    List<FacetCount> cities,
    List<FacetCount> statuses,
    List<FacetCount> engagements
) {
    /** @param key valeur brute (code, ville, nom d'enum) ; @param count professionnels DISTINCTS */
    public record FacetCount(String key, long count) {}
}
