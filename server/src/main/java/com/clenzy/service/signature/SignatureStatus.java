package com.clenzy.service.signature;

/**
 * Statuts possibles d'une demande de signature electronique.
 */
public enum SignatureStatus {
    PENDING,
    SENT,
    VIEWED,
    SIGNED,
    DECLINED,
    EXPIRED,
    CANCELLED
}
