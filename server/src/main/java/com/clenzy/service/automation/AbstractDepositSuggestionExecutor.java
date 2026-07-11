package com.clenzy.service.automation;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.Issue;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.repository.IssueRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.agent.supervision.AutoApplyGate;
import com.clenzy.service.agent.supervision.SupervisionAutoApplyService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Socle des executeurs qui transforment un evenement caution en SUGGESTION
 * actionnable (fiche 08 — les flux « argent » ne s'executent JAMAIS seuls sans
 * opt-in explicite).
 *
 * <p>L'executeur ne touche PAS a l'argent : il verifie qu'une caution encore retenue
 * (HELD) existe pour la reservation, calcule le montant COTE SERVEUR (montant de la
 * caution en base — purement indicatif dans la suggestion) et cree une suggestion
 * actionnable ({@code SupervisionSuggestionService}). C'est l'APPLY de la suggestion
 * (SuggestionActionExecutor) qui re-resout la caution, re-verifie son statut et libere
 * le hold Stripe hors transaction — jamais le montant stocke ici.</p>
 *
 * <p><b>Vague 2 autonomie (N1 max)</b> : l'{@link AutoApplyGate} decide avant la
 * creation de la carte. Enveloppe commune : AUCUNE {@link Issue} OPEN/QUALIFIED sur
 * le logement (filtre PROPRIETE, conservateur — le lien Issue→reservation via
 * source_intervention_id n'est pas exploite : une anomalie ouverte n'importe ou sur
 * le bien suffit a garder l'humain dans la boucle) ; RELEASE exige en plus le delai
 * post-checkout, REFUND l'annulation confirmee (statut resa re-lu). En AUTO, la carte
 * est appliquee par le pipeline d'apply (acteur systeme, notification
 * SUPERVISION_AUTO_APPLIED avec montant + reservation) — jamais silencieux (max
 * NOTIFY au catalogue).</p>
 *
 * <p><b>INVARIANT argent (MONEY_TOOLS intact)</b> : l'apply de DEPOSIT_RELEASE /
 * DEPOSIT_REFUND ne fait QUE liberer un hold Stripe ({@code releaseHold} apres
 * re-lecture du statut HELD — zero debit). Une caution non-HELD (capture en cours,
 * deja liberee) fait echouer l'apply → la carte reste PENDING (repli HITL) ; aucun
 * chemin auto ne peut deboucher sur un debit reel.</p>
 *
 * <p>Idempotence : dedup generique du moteur (regle x reservation, triggers one-shot)
 * + deduplication par intitule en attente cote file de suggestions (un intitule est
 * stable par caution : le montant ne change pas tant qu'elle est HELD).</p>
 */
abstract class AbstractDepositSuggestionExecutor implements AutomationActionExecutor {

    /** Module « finance » de la constellation (jauge HITL). */
    static final String MODULE_FINANCE = "fin";

    /** Statuts d'anomalie terrain qui bloquent l'auto-liberation d'une caution. */
    static final List<Issue.IssueStatus> BLOCKING_ISSUE_STATUSES =
            List.of(Issue.IssueStatus.OPEN, Issue.IssueStatus.QUALIFIED);

    private final SecurityDepositRepository depositRepository;
    private final SupervisionSuggestionService suggestionService;
    private final AutoApplyGate autoApplyGate;
    private final SupervisionAutoApplyService autoApplyService;
    private final IssueRepository issueRepository;
    private final ObjectMapper objectMapper;
    /** Horloge injectee (delai post-checkout du gate) — accessible aux sous-classes. */
    protected final Clock clock;

    protected AbstractDepositSuggestionExecutor(SecurityDepositRepository depositRepository,
                                                SupervisionSuggestionService suggestionService,
                                                AutoApplyGate autoApplyGate,
                                                SupervisionAutoApplyService autoApplyService,
                                                IssueRepository issueRepository,
                                                ObjectMapper objectMapper,
                                                Clock clock) {
        this.depositRepository = depositRepository;
        this.suggestionService = suggestionService;
        this.autoApplyGate = autoApplyGate;
        this.autoApplyService = autoApplyService;
        this.issueRepository = issueRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
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

        // Vague 2 : gate AVANT la creation. Toute condition non satisfaite (toggle OFF,
        // anomalie ouverte, delai/annulation) → carte HITL comme avant.
        AutoApplyGate.AutoDecision decision = autoApplyGate.decide(
                ctx.orgId(), MODULE_FINANCE, applyActionType(),
                envelopeInputs(ctx.orgId(), property.getId(), reservation));
        boolean auto = decision == AutoApplyGate.AutoDecision.AUTO_NOTIFY
                || decision == AutoApplyGate.AutoDecision.AUTO_SILENT;
        if (auto) {
            // Carte creee SANS notif « en attente » puis appliquee par le MEME pipeline
            // que le bouton humain : re-lecture du statut caution + releaseHold hors
            // transaction (zero debit) ; un echec (statut non-HELD entre-temps, Stripe
            // indisponible) laisse la carte PENDING (compensation → repli HITL).
            return suggestionService.recordActionableForAutoApply(
                            ctx.orgId(), property.getId(), MODULE_FINANCE, reservation.getId(),
                            title(deposit), motif(deposit, reservation),
                            applyActionType(), params,
                            StripeAmounts.toMinorUnits(deposit.getAmount()), "warning")
                    .map(suggestionId -> {
                        autoApplyService.autoApply(decision, ctx.orgId(), property.getId(),
                                MODULE_FINANCE, suggestionId, title(deposit),
                                motif(deposit, reservation),
                                StripeAmounts.toMinorUnits(deposit.getAmount()));
                        return ExecutionResult.executed();
                    })
                    .orElseGet(() -> ExecutionResult.skipped(
                            "Suggestion identique deja en attente pour ce logement"));
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

    /**
     * Inputs d'enveloppe du gate : condition commune « aucune anomalie ouverte sur
     * le logement » + inputs specifiques du type ({@link #addTypeInputs}).
     */
    private Map<String, Object> envelopeInputs(Long orgId, Long propertyId, Reservation reservation) {
        Map<String, Object> inputs = new HashMap<>();
        inputs.put(AutoApplyGate.INPUT_HAS_OPEN_ISSUES,
                issueRepository.existsByOrganizationIdAndPropertyIdAndStatusIn(
                        orgId, propertyId, BLOCKING_ISSUE_STATUSES));
        addTypeInputs(inputs, reservation);
        return inputs;
    }

    /** Montant + devise lisibles (indicatifs — le montant reel est re-resolu a l'apply). */
    static String amountLabel(SecurityDeposit deposit) {
        String currency = deposit.getCurrency() != null && !deposit.getCurrency().isBlank()
                ? deposit.getCurrency() : "EUR";
        return deposit.getAmount().toPlainString() + " " + currency;
    }

    /** Type d'action executable porte par la suggestion (SupervisionActionType). */
    protected abstract String applyActionType();

    /** Inputs d'enveloppe specifiques du type (delai post-checkout, annulation…). */
    protected abstract void addTypeInputs(Map<String, Object> inputs, Reservation reservation);

    /** Intitule de la suggestion (stable par caution : sert de cle de deduplication). */
    protected abstract String title(SecurityDeposit deposit);

    /** Motif detaille affiche a l'operateur. */
    protected abstract String motif(SecurityDeposit deposit, Reservation reservation);
}
