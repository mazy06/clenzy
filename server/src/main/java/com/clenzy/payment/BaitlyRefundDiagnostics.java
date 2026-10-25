package com.clenzy.payment;

/** Diagnostics Baitly bornés : aucune réponse PSP ni exception privée n'est conservée. */
public final class BaitlyRefundDiagnostics {
    public static final String RECONCILIATION_REQUIRED = "Confirmation du remboursement indisponible ; rapprochement requis";
    public static final String PENDING = "Remboursement en attente de confirmation du prestataire";
    public static final String REJECTED = "Remboursement refusé par le prestataire";

    private BaitlyRefundDiagnostics() {}
}
