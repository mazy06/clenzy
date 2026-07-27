package com.clenzy.model;

import java.util.Locale;
import java.util.Set;

/**
 * Sources de reservation pour lesquelles le voyageur a deja regle SUR LE CANAL :
 * le PMS n'encaisse rien, le sejour compte comme paye.
 *
 * <p><b>Reference unique.</b> Cette liste etait recopiee a cinq endroits — deux
 * cote serveur ({@code PaymentQueryService}, {@code ICalImportSession}), trois
 * cote client ({@code PanelFinancial}, {@code usePlanningData},
 * {@code GuestCardDialog}) — avec des valeurs qui divergeaient. Quand Channex a
 * ete branche en ecrivant {@code source = "channex"}, aucune des cinq copies n'a
 * ete mise a jour : tout sejour arrive par Channex a ete compte « reste a payer »
 * alors qu'il etait regle. La dupliquer a nouveau reproduira ce bug.</p>
 *
 * <p><b>Ce n'est qu'un palliatif.</b> Deduire qui a encaisse depuis le nom du
 * canal reste une confusion de deux informations distinctes : le canal qui a
 * VENDU et le regime d'ENCAISSEMENT. La correction de fond consiste a persister
 * le regime sur la reservation ; cette classe disparaitra alors.</p>
 */
public final class OtaPaidSources {

    /**
     * {@code other} y figure parce qu'un canal non reconnu reste un canal de
     * vente, qui encaisse pour le compte de l'hote — un flux iCal ne se branche
     * pas sur une vente en direct.
     *
     * <p>{@code channex} n'est plus produit depuis que la source derive du nom de
     * l'OTA, mais reste ici pour les lignes anterieures.</p>
     */
    private static final Set<String> VALUES =
        Set.of("airbnb", "booking", "vrbo", "expedia", "other", "channex");

    private OtaPaidSources() {
    }

    /** Insensible a la casse : les producteurs n'ont pas tous ete rigoureux. */
    public static boolean contains(String source) {
        return source != null && VALUES.contains(source.toLowerCase(Locale.ROOT));
    }
}
