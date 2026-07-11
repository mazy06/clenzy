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
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Map;

/**
 * Executeur {@code SUGGEST_DEPOSIT_RELEASE} (fiche 08, F4c) : declencheur
 * temporel CHECK_OUT_PASSED (offset J+X recommande : +2, laissant le temps de
 * constater d'eventuels degats). Si la caution est encore retenue (HELD),
 * propose a l'operateur de la liberer — AUCUN mouvement d'argent ici, l'effet
 * Stripe est porte par l'apply ({@code DEPOSIT_RELEASE} : liberation de hold,
 * zero debit). Caution absente ou deja liberee/encaissee → skipped.
 *
 * <p>Vague 2 (N1 max) : auto-liberation possible via le gate si aucune anomalie
 * ouverte ET check-out + {@code minDaysAfterCheckout} (defaut 2) ≤ aujourd'hui —
 * re-verifie ICI au moment AUTO, meme si la regle CHECK_OUT_PASSED a le meme
 * rythme (une regle a offset different ne contourne pas l'enveloppe).</p>
 */
@Service
public class SuggestDepositReleaseExecutor extends AbstractDepositSuggestionExecutor {

    public SuggestDepositReleaseExecutor(SecurityDepositRepository depositRepository,
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
        return AutomationAction.SUGGEST_DEPOSIT_RELEASE;
    }

    @Override
    protected String applyActionType() {
        return SupervisionActionType.DEPOSIT_RELEASE;
    }

    /**
     * Delai post-checkout re-verifie au moment AUTO (jour serveur, conservateur) :
     * sans date de depart, l'input est absent → le gate rend CARD (fail-safe).
     */
    @Override
    protected void addTypeInputs(Map<String, Object> inputs, Reservation reservation) {
        if (reservation.getCheckOut() != null) {
            inputs.put(AutoApplyGate.INPUT_DAYS_SINCE_CHECKOUT,
                    ChronoUnit.DAYS.between(reservation.getCheckOut(), LocalDate.now(clock)));
        }
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
