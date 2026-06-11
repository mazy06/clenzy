package com.clenzy.exception;

/**
 * Echec de validation metier d'une operation de paiement (intervention
 * annulee, deja payee, montant client incoherent, email manquant...).
 *
 * <p>Mappee en HTTP 400 par les controllers de paiement — le message est
 * destine au client et reprend mot pour mot les messages historiques de
 * {@code PaymentController} (contrat API inchange, refactor T-ARCH-01).</p>
 */
public class PaymentValidationException extends RuntimeException {

    public PaymentValidationException(String message) {
        super(message);
    }
}
