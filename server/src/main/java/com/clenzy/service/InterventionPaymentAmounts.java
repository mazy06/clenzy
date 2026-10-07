package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.ServiceQuote;
import java.math.BigDecimal;
import java.util.List;

/** Calcul commun du montant exigible, sans conversion ni effet de bord. */
final class InterventionPaymentAmounts {
    private InterventionPaymentAmounts() {}

    static BigDecimal payable(Intervention mission, List<ServiceQuote> quotes, boolean deposit) {
        var accepted = quotes.stream().filter(q -> q.getStatus() == ServiceQuote.Status.APPROVED).toList();
        if (accepted.size() > 1) return null;
        var approved = accepted.isEmpty() ? null : accepted.getFirst();
        // Une date historique seule ne prouve pas l'encaissement. Ne pas
        // réclamer non plus le prix entier : ce dossier doit être rapproché.
        if (approved != null && (approved.getDepositPaidAt() != null || approved.getDepositTransactionRef() != null)
                && (approved.getDepositPaidAt() == null || approved.getDepositTransactionRef() == null
                    || approved.getDepositTransactionRef().isBlank() || approved.getDepositAmount() == null
                    || approved.getDepositAmount().signum() <= 0)) return null;
        if (deposit) {
            return approved != null && approved.getDepositPaidAt() == null ? approved.getDepositAmount() : null;
        }
        if (mission.getEstimatedCost() == null) return null;
        BigDecimal paid = approved != null && approved.getDepositPaidAt() != null
                && approved.getDepositAmount() != null ? approved.getDepositAmount() : BigDecimal.ZERO;
        return paid.compareTo(mission.getEstimatedCost()) > 0 ? null : mission.getEstimatedCost().subtract(paid);
    }
}
