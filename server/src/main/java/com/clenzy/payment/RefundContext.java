package com.clenzy.payment;

import java.math.BigDecimal;

/**
 * Contexte enrichi pour les opérations de remboursement.
 *
 * <h2>Pourquoi ce DTO</h2>
 * <p>L'interface historique
 * {@code refundPayment(String providerTxId, BigDecimal amount, String reason)}
 * était suffisante pour Stripe (un seul identifiant suffit), mais inadaptée
 * pour les providers regionaux qui ont besoin de plus de contexte :</p>
 *
 * <ul>
 *   <li><strong>PayTabs</strong> : nécessite {@code cart_id} (notre
 *       transactionRef) en plus du {@code tran_ref} pour identifier la
 *       transaction côté marchand.</li>
 *   <li><strong>CMI</strong> : refund manuel via back-office, n/a.</li>
 *   <li><strong>Payzone</strong> : nécessite l'orgId pour charger les
 *       credentials marchand spécifiques.</li>
 *   <li><strong>PayPal</strong> : nécessite le {@code capture_id} (différent
 *       de l'{@code order_id} retourné par createPayment).</li>
 * </ul>
 *
 * <h2>Compatibilité</h2>
 * <p>La signature {@code refundPayment(String, BigDecimal, String)} reste
 * dans l'interface comme méthode par défaut qui délègue à {@link #refundPayment}.
 * Les providers qui n'ont pas besoin de contexte enrichi (Stripe) peuvent
 * continuer à l'implémenter directement.</p>
 *
 * @param orgId organisation propriétaire de la transaction (tenant)
 * @param providerTxId identifiant du provider (tran_ref PayTabs, capture_id
 *                     PayPal, etc.) — généralement stocké dans
 *                     {@code PaymentTransaction.providerTxId}
 * @param originalTransactionRef notre référence Clenzy
 *                               (= {@code PaymentTransaction.transactionRef})
 * @param currency devise alpha-3 de la transaction originale (MAD, EUR, SAR…)
 * @param originalAmount montant total de la transaction originale (peut être
 *                       différent de l'amount du refund pour les refunds
 *                       partiels)
 */
public record RefundContext(
    Long orgId,
    String providerTxId,
    String originalTransactionRef,
    String currency,
    BigDecimal originalAmount
) {
    public RefundContext {
        if (orgId == null) throw new IllegalArgumentException("orgId is required");
        if (providerTxId == null || providerTxId.isBlank()) {
            throw new IllegalArgumentException("providerTxId is required");
        }
        if (currency == null || currency.isBlank()) {
            throw new IllegalArgumentException("currency is required");
        }
    }
}
