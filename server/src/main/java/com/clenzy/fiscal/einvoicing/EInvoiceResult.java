package com.clenzy.fiscal.einvoicing;

/**
 * Resultat d'une operation d'e-invoicing (clear/report), CLZ-P0-04.
 *
 * @param status     statut resultant
 * @param externalRef reference externe retournee par l'autorite (UUID clearance, id PDP...) ; null si N/A
 * @param message    message d'erreur ou d'information ; null si succes silencieux
 */
public record EInvoiceResult(EInvoiceStatus status, String externalRef, String message) {

    public static EInvoiceResult notRequired() {
        return new EInvoiceResult(EInvoiceStatus.NOT_REQUIRED, null, null);
    }

    public static EInvoiceResult cleared(String externalRef) {
        return new EInvoiceResult(EInvoiceStatus.CLEARED, externalRef, null);
    }

    public static EInvoiceResult reported(String externalRef) {
        return new EInvoiceResult(EInvoiceStatus.REPORTED, externalRef, null);
    }

    public static EInvoiceResult pending(String message) {
        return new EInvoiceResult(EInvoiceStatus.PENDING, null, message);
    }

    public static EInvoiceResult failed(String message) {
        return new EInvoiceResult(EInvoiceStatus.FAILED, null, message);
    }
}
