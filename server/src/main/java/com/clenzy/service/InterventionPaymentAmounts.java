package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.ServiceQuote;
import java.math.BigDecimal;
import java.util.List;

/** Calcul commun du montant exigible, sans conversion ni effet de bord. */
final class InterventionPaymentAmounts {
    private InterventionPaymentAmounts() {}

    static BigDecimal payable(Intervention mission, List<ServiceQuote> quotes, boolean deposit) {
        var approved = quotes.stream().filter(q -> q.getStatus() == ServiceQuote.Status.APPROVED)
                .findFirst().orElse(null);
        if (deposit) {
            return approved != null && approved.getDepositPaidAt() == null ? approved.getDepositAmount() : null;
        }
        if (mission.getEstimatedCost() == null) return null;
        BigDecimal paid = approved != null && approved.getDepositPaidAt() != null
                && approved.getDepositAmount() != null ? approved.getDepositAmount() : BigDecimal.ZERO;
        return mission.getEstimatedCost().subtract(paid).max(BigDecimal.ZERO);
    }
}
