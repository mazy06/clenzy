package com.clenzy.exception;

/** Une operation d'acces physique ne peut pas etre confirmee par le fournisseur. */
public class KeyExchangeProviderNotReadyException extends IllegalStateException {
    public KeyExchangeProviderNotReadyException(String message) {
        super(message);
    }
}
