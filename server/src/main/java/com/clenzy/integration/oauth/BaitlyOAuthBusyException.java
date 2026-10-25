package com.clenzy.integration.oauth;

/** Refus local de concurrence, sans appel ni diagnostic du fournisseur. */
public final class BaitlyOAuthBusyException extends IllegalStateException {
    public BaitlyOAuthBusyException() {
        super("Opération OAuth déjà en cours ; réessayer ultérieurement");
    }
}
