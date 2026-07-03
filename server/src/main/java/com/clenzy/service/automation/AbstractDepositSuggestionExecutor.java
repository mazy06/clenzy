package com.clenzy.service.automation;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

/**
 * Socle des executeurs vague 3 qui transforment un evenement caution en SUGGESTION
 * actionnable HITL (fiche 08 — les flux « argent » ne s'executent JAMAIS seuls).
 *
 * <p>L'executeur ne touche PAS a l'argent : il verifie qu'une caution encore retenue
 * (HELD) existe pour la reservation, calcule le montant COTE SERVEUR (montant de la
 * caution en base — purement indicatif dans la suggestion) et cree une suggestion
 * actionnable ({@code SupervisionSuggestionService}). C'est l'APPLY de la suggestion
 * (SuggestionActionExecutor) qui re-resout la caution, re-verifie son statut et libere
 * le hold Stripe hors transaction — jamais le montant stocke ici.</p>
 *
 * <p>Idempotence : dedup generique du moteur (regle x reservation, triggers one-shot)
 * + deduplication par intitule en attente cote file de suggestions (un intitule est
 * stable par caution : le montant ne change pas tant qu'elle est HELD).</p>
 */
abstract class AbstractDepositSuggestionExecutor implements AutomationActionExecutor {

    /** Module « finance » de la constellation (jauge HITL). */
    static final String MODULE_FINANCE = "fin";

    private final SecurityDepositRepository depositRepository;
    private final SupervisionSuggestionService suggestionService;
    private final ObjectMapper objectMapper;

    protected AbstractDepositSuggestionExecutor(SecurityDepositRepository depositRepository,
                                                SupervisionSuggestionService suggestionService,
                                                ObjectMapper objectMapper) {
        this.depositRepository = depositRepository;
        this.suggestionService = suggestionService;
        this.objectMapper = objectMapper;
    }

    @Override
    public final ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        if (!AutomationSubject.TYPE_RESERVATION.equals(ctx.subjectType()) || ctx.reservation() == null) {
            // Regle mal cablee : echec explicite (statut FAILED cote moteur).
            throw new IllegalStateException(getClass().getSimpleName() + " attend un sujet "
                    + AutomationSubject.TYPE_RESERVATION + " resolu, recu : " + ctx.subjectType()
                    + "#" + ctx.subjectId() + " (regle " + rule.getId() + ")");
        }
        Reservation reservation = ctx.reservation();
        Property property = reservation.getProperty();
        if (property == null || property.getId() == null) {
            return ExecutionResult.skipped("Reservation " + reservation.getId()
                    + " sans logement — la file de suggestions est par logement");
        }

        SecurityDeposit deposit = depositRepository
                .findByOrganizationIdAndReservationId(ctx.orgId(), reservation.getId())
                .orElse(null);
        if (deposit == null) {
            return ExecutionResult.skipped("Aucune caution pour la reservation " + reservation.getId());
        }
        if (deposit.getStatus() != SecurityDepositStatus.HELD) {
            return ExecutionResult.skipped("Caution " + deposit.getId() + " au statut "
                    + deposit.getStatus() + " — rien a liberer");
        }

        String params;
        try {
            params = objectMapper.writeValueAsString(Map.of(
                    "reservationId", reservation.getId(),
                    "depositId", deposit.getId()));
        } catch (Exception e) {
            throw new IllegalStateException("Serialisation des params de suggestion impossible : "
                    + e.getMessage(), e);
        }

        boolean created = suggestionService.recordActionableStrict(
                ctx.orgId(), property.getId(), MODULE_FINANCE, reservation.getId(),
                title(deposit), motif(deposit, reservation),
                applyActionType(), params,
                StripeAmounts.toMinorUnits(deposit.getAmount()), "warning");
        return created
                ? ExecutionResult.executed()
                : ExecutionResult.skipped("Suggestion identique deja en attente pour ce logement");
    }

    /** Montant + devise lisibles (indicatifs — le montant reel est re-resolu a l'apply). */
    static String amountLabel(SecurityDeposit deposit) {
        String currency = deposit.getCurrency() != null && !deposit.getCurrency().isBlank()
                ? deposit.getCurrency() : "EUR";
        return deposit.getAmount().toPlainString() + " " + currency;
    }

    /** Type d'action executable porte par la suggestion (SupervisionActionType). */
    protected abstract String applyActionType();

    /** Intitule de la suggestion (stable par caution : sert de cle de deduplication). */
    protected abstract String title(SecurityDeposit deposit);

    /** Motif detaille affiche a l'operateur. */
    protected abstract String motif(SecurityDeposit deposit, Reservation reservation);
}
