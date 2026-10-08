package com.clenzy.exception;

/** Refus métier explicite avant tout transfert, affichable au gestionnaire. */
public class BaitlyPayoutNotReadyException extends IllegalStateException {
    public BaitlyPayoutNotReadyException(String message) {
        super(message);
    }
}
