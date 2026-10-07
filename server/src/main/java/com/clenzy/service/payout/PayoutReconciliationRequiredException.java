package com.clenzy.service.payout;

/** Aucun nouveau transfert ne doit partir quand le résultat du précédent est incertain. */
public class PayoutReconciliationRequiredException extends IllegalStateException {
    private final String transferReference;
    public PayoutReconciliationRequiredException(String message, String transferReference, Throwable cause) {
        super(message, cause);
        this.transferReference = transferReference;
    }
    public String getTransferReference() { return transferReference; }
}
