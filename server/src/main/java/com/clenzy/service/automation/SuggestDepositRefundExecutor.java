package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

/**
 * Executeur {@code SUGGEST_DEPOSIT_REFUND} (fiche 08, F2b — vague 3 HITL) :
 * sur annulation de reservation (trigger RESERVATION_CANCELLED), si une caution
 * est encore retenue (HELD), propose a l'operateur de la rembourser — AUCUN
 * mouvement d'argent ici, l'effet Stripe est porte par l'apply de la suggestion
 * ({@code DEPOSIT_REFUND}). Pas de caution / caution deja liberee → skipped.
 */
@Service
public class SuggestDepositRefundExecutor extends AbstractDepositSuggestionExecutor {

    public SuggestDepositRefundExecutor(SecurityDepositRepository depositRepository,
                                        SupervisionSuggestionService suggestionService,
                                        ObjectMapper objectMapper) {
        super(depositRepository, suggestionService, objectMapper);
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SUGGEST_DEPOSIT_REFUND;
    }

    @Override
    protected String applyActionType() {
        return SupervisionActionType.DEPOSIT_REFUND;
    }

    @Override
    protected String title(SecurityDeposit deposit) {
        return "Rembourser la caution de " + amountLabel(deposit) + " — reservation annulee";
    }

    @Override
    protected String motif(SecurityDeposit deposit, Reservation reservation) {
        return "La reservation " + reservation.getId() + " a ete annulee alors que la caution "
                + "de " + amountLabel(deposit) + " est encore retenue (pre-autorisation Stripe). "
                + "Appliquer libere le hold (aucun debit) apres re-verification de son etat.";
    }
}
