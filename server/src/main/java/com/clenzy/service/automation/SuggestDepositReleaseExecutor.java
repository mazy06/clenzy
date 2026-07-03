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
 * Executeur {@code SUGGEST_DEPOSIT_RELEASE} (fiche 08, F4c — vague 3 HITL) :
 * declencheur temporel CHECK_OUT_PASSED (offset J+X recommande : +2, laissant le
 * temps de constater d'eventuels degats). Si la caution est encore retenue (HELD),
 * propose a l'operateur de la liberer — AUCUN mouvement d'argent ici, l'effet
 * Stripe est porte par l'apply ({@code DEPOSIT_RELEASE}). Caution absente ou deja
 * liberee/encaissee → skipped.
 */
@Service
public class SuggestDepositReleaseExecutor extends AbstractDepositSuggestionExecutor {

    public SuggestDepositReleaseExecutor(SecurityDepositRepository depositRepository,
                                         SupervisionSuggestionService suggestionService,
                                         ObjectMapper objectMapper) {
        super(depositRepository, suggestionService, objectMapper);
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SUGGEST_DEPOSIT_RELEASE;
    }

    @Override
    protected String applyActionType() {
        return SupervisionActionType.DEPOSIT_RELEASE;
    }

    @Override
    protected String title(SecurityDeposit deposit) {
        return "Liberer la caution de " + amountLabel(deposit) + " — sejour termine";
    }

    @Override
    protected String motif(SecurityDeposit deposit, Reservation reservation) {
        return "Le sejour de la reservation " + reservation.getId() + " est termine"
                + (reservation.getCheckOut() != null ? " (depart le " + reservation.getCheckOut() + ")" : "")
                + " et la caution de " + amountLabel(deposit) + " est encore retenue. "
                + "Si aucun degat n'est a deplorer, appliquer libere le hold Stripe (aucun debit) "
                + "apres re-verification de son etat.";
    }
}
