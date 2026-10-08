package com.clenzy.model;

/**
 * Responsable de l'encaissement du séjour, sans preuve du paiement ni du versement.
 *
 * <p>Cette information etait jusqu'ici REDERIVEE du nom du canal, a cinq
 * endroits, par des listes en dur qui divergeaient — c'est ainsi que les sejours
 * Channex se sont retrouves comptes « reste a payer » alors qu'ils etaient
 * regles. Or le canal qui a VENDU et le regime d'ENCAISSEMENT sont deux
 * informations distinctes : Vrbo encaisse, un site en marque blanche non.</p>
 *
 * <p>Elle est desormais decidee UNE fois, a l'ecriture de la reservation, et
 * figee sur la ligne. Les lecteurs la lisent, ils ne la devinent plus.</p>
 */
public enum PaymentCollection {

    /** Le PMS encaisse : reservation directe, booking engine, saisie manuelle. */
    PMS,

    /**
     * Le canal gère l'encaissement. Son versement au bénéficiaire se suit séparément.
     */
    CHANNEL,

    /** Le canal n'a pas précisé qui doit encaisser : aucune relance automatique. */
    UNKNOWN
}
