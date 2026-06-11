package com.clenzy.exception;

/**
 * Echec d'execution d'une operation de paiement cote provider/orchestrateur
 * (session non creee, remboursement refuse...).
 *
 * <p>Mappee en HTTP 500 par les controllers de paiement — le message est
 * destine au client et reprend mot pour mot les messages historiques de
 * {@code PaymentController} (contrat API inchange, refactor T-ARCH-01).</p>
 */
public class PaymentProcessingException extends RuntimeException {

    public PaymentProcessingException(String message) {
        super(message);
    }
}
