package com.clenzy.marketplace.model;

/**
 * Vie d'une demande de devis.
 *
 * <p>Deux parties agissent, chacune sur ses transitions : le PRESTATAIRE
 * chiffre ou renonce, le DEMANDEUR accepte, refuse ou retire. Aucune transition
 * n'est permise aux deux — c'est ce qui rend le fil lisible plus tard.</p>
 */
public enum QuoteRequestStatus {
    /** Envoyee, le prestataire n'a pas encore repondu. */
    SENT,
    /** Le prestataire a chiffre. En attente de la decision du demandeur. */
    QUOTED,
    /** Le demandeur a accepte : une intervention en decoule. */
    ACCEPTED,
    /** Le demandeur a refuse le devis. */
    DECLINED,
    /** Le prestataire ne donne pas suite. */
    TURNED_DOWN,
    /** Le demandeur a retire sa demande avant reponse. */
    WITHDRAWN,
    /** Le devis a depasse sa date de validite sans decision. */
    EXPIRED;

    /** Etat final : plus aucune transition n'est possible. */
    public boolean isFinal() {
        return this == ACCEPTED || this == DECLINED || this == TURNED_DOWN
            || this == WITHDRAWN || this == EXPIRED;
    }

    /** Le prestataire peut-il encore chiffrer ? */
    public boolean acceptsQuote() {
        return this == SENT;
    }

    /** Le demandeur peut-il encore trancher ? */
    public boolean acceptsDecision() {
        return this == QUOTED;
    }
}
