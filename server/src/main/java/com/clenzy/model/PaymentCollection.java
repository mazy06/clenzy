package com.clenzy.model;

/**
 * Qui a encaisse le sejour.
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
     * Le canal a deja encaisse pour le compte de l'hote : le PMS ne percoit
     * rien et le sejour compte comme paye.
     */
    CHANNEL
}
