package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.repository.IssueRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.agent.supervision.AutoApplyGate;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionAutoApplyService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.Map;

/**
 * Executeur {@code SUGGEST_DEPOSIT_REFUND} (fiche 08, F2b) : sur annulation de
 * reservation (trigger RESERVATION_CANCELLED), si une caution est encore retenue
 * (HELD), propose a l'operateur de la rembourser — AUCUN mouvement d'argent ici,
 * l'effet Stripe est porte par l'apply de la suggestion ({@code DEPOSIT_REFUND} :
 * liberation de hold, zero debit). Pas de caution / caution deja liberee → skipped.
 *
 * <p>Vague 2 (N1 max) : auto-remboursement possible via le gate si aucune anomalie
 * ouverte ET annulation confirmee (statut resa RE-LU ici — pas seulement le
 * trigger). « Aucun debit en cours » = re-verification du statut HELD par l'apply
 * existant (releaseDeposit) : une capture entre-temps fait echouer l'apply → carte
 * PENDING (pas de second check desynchronise ici).</p>
 */
@Service
public class SuggestDepositRefundExecutor extends AbstractDepositSuggestionExecutor {

    public SuggestDepositRefundExecutor(SecurityDepositRepository depositRepository,
                                        SupervisionSuggestionService suggestionService,
                                        AutoApplyGate autoApplyGate,
                                        SupervisionAutoApplyService autoApplyService,
                                        IssueRepository issueRepository,
                                        ObjectMapper objectMapper,
                                        Clock clock) {
        super(depositRepository, suggestionService, autoApplyGate, autoApplyService,
                issueRepository, objectMapper, clock);
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SUGGEST_DEPOSIT_REFUND;
    }

    @Override
    protected String applyActionType() {
        return SupervisionActionType.DEPOSIT_REFUND;
    }

    /** Annulation confirmee = statut de la reservation RE-LU (jamais deduit du trigger seul). */
    @Override
    protected void addTypeInputs(Map<String, Object> inputs, Reservation reservation) {
        inputs.put(AutoApplyGate.INPUT_CANCELLATION_CONFIRMED,
                "cancelled".equalsIgnoreCase(reservation.getStatus()));
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
