package com.clenzy.service.messaging;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Reservation;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Tick horaire du moteur d'automatisation :
 * <ol>
 *   <li><b>Drain</b> — execute les {@code AutomationExecution} PENDING arrivees a echeance ;</li>
 *   <li><b>Sweep temporel (F3b)</b> — re-evalue les declencheurs J-X / jour J / J+X contre les
 *       reservations a venir ou recemment parties. Complement de l'amorcage a la creation
 *       ({@code onReservationCreated}) : couvre les regles creees APRES la reservation et les
 *       reservations importees hors {@code ReservationService} (iCal / OTA).</li>
 * </ol>
 *
 * <p>Le sweep est idempotent : {@code evaluateRulesForReservation} ne cree jamais deux
 * executions pour un meme couple (regle x reservation).</p>
 */
@Service
public class AutomationSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(AutomationSchedulerService.class);

    /**
     * Borne dure des fenetres de sweep : un offset de regle aberrant (ex. 10 000) ne doit pas
     * transformer le tick horaire en full-scan des reservations de l'org.
     */
    static final int MAX_SWEEP_WINDOW_DAYS = 60;

    private static final Set<AutomationTrigger> CHECK_IN_TRIGGERS =
        EnumSet.of(AutomationTrigger.CHECK_IN_APPROACHING, AutomationTrigger.CHECK_IN_DAY);
    private static final Set<AutomationTrigger> CHECK_OUT_TRIGGERS =
        EnumSet.of(AutomationTrigger.CHECK_OUT_DAY, AutomationTrigger.CHECK_OUT_PASSED,
            AutomationTrigger.REVIEW_REMINDER);

    private final AutomationEvaluationService evaluationService;
    private final AutomationRuleRepository ruleRepository;
    private final ReservationRepository reservationRepository;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final Clock clock;

    public AutomationSchedulerService(AutomationEvaluationService evaluationService,
                                      AutomationRuleRepository ruleRepository,
                                      ReservationRepository reservationRepository,
                                      TenantScopedExecutor tenantScopedExecutor,
                                      Clock clock) {
        this.evaluationService = evaluationService;
        this.ruleRepository = ruleRepository;
        this.reservationRepository = reservationRepository;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 * * * *") // Every hour
    public void processScheduledAutomations() {
        log.debug("Verification des automatisations planifiees...");
        try {
            evaluationService.processScheduledExecutions();
        } catch (Exception e) {
            // Isolation des deux etapes : un drain en erreur ne doit pas priver le sweep
            // (et inversement). L'echec reste visible (log.error) et le tick suivant retente.
            log.error("Drain des executions d'automatisation en erreur: {}", e.getMessage(), e);
        }
        sweepTemporalTriggers();
    }

    /**
     * F3b : evalue les declencheurs temporels pour chaque org ayant des regles actives.
     *
     * <p>RESERVATION_CONFIRMED est volontairement exclu : c'est un declencheur evenementiel
     * execute a la creation de la reservation (F1b) — le re-evaluer ici enverrait des messages
     * de bienvenue retroactifs aux reservations importees.</p>
     */
    void sweepTemporalTriggers() {
        Map<Long, List<AutomationRule>> rulesByOrg = ruleRepository.findByEnabledTrue().stream()
            .filter(rule -> rule.getOrganizationId() != null)
            // Seuls les declencheurs temporels sont sweepables : RESERVATION_CONFIRMED et
            // les declencheurs evenementiels (bruit, facture...) passent par fireTrigger.
            .filter(rule -> CHECK_IN_TRIGGERS.contains(rule.getTriggerType())
                || CHECK_OUT_TRIGGERS.contains(rule.getTriggerType()))
            .collect(Collectors.groupingBy(AutomationRule::getOrganizationId));

        for (Map.Entry<Long, List<AutomationRule>> entry : rulesByOrg.entrySet()) {
            Long orgId = entry.getKey();
            try {
                // Z2-EFFETS : hors HTTP, contexte tenant pose via TenantScopedExecutor
                // (TenantContext + filtre Hibernate, nettoyes en finally cote executor).
                tenantScopedExecutor.runAsOrganization(orgId,
                    () -> sweepOrganization(orgId, entry.getValue()));
            } catch (Exception e) {
                // Isolation par org (pattern GuestMessagingScheduler / ICalSyncScheduler).
                log.error("Sweep automation en erreur pour org={}: {}", orgId, e.getMessage(), e);
            }
        }
    }

    private void sweepOrganization(Long orgId, List<AutomationRule> rules) {
        // Fenetres calculees en date serveur avec une marge d'un jour de chaque cote pour
        // couvrir tous les fuseaux possibles des logements de l'org (le tranchage fin par
        // fuseau du logement est fait par calculateScheduledTime cote evaluation).
        LocalDate today = LocalDate.now(clock);

        List<AutomationRule> checkInRules = rulesFor(rules, CHECK_IN_TRIGGERS);
        if (!checkInRules.isEmpty()) {
            int lookahead = maxAbsOffset(checkInRules);
            List<Reservation> upcoming = reservationRepository.findConfirmedByCheckInRange(
                today.minusDays(1), today.plusDays(lookahead + 1L), orgId);
            evaluate(upcoming, triggersOf(checkInRules), orgId);
        }

        List<AutomationRule> checkOutRules = rulesFor(rules, CHECK_OUT_TRIGGERS);
        if (!checkOutRules.isEmpty()) {
            int lookback = maxAbsOffset(checkOutRules);
            List<Reservation> departed = reservationRepository.findConfirmedByCheckOutRange(
                today.minusDays(lookback + 1L), today.plusDays(1), orgId);
            evaluate(departed, triggersOf(checkOutRules), orgId);
        }
    }

    private void evaluate(List<Reservation> reservations, Set<AutomationTrigger> triggers, Long orgId) {
        for (Reservation reservation : reservations) {
            for (AutomationTrigger trigger : triggers) {
                evaluationService.evaluateRulesForReservation(reservation, trigger, orgId);
            }
        }
    }

    private static List<AutomationRule> rulesFor(List<AutomationRule> rules, Set<AutomationTrigger> triggers) {
        return rules.stream().filter(rule -> triggers.contains(rule.getTriggerType())).toList();
    }

    private static Set<AutomationTrigger> triggersOf(List<AutomationRule> rules) {
        return rules.stream().map(AutomationRule::getTriggerType)
            .collect(Collectors.toCollection(() -> EnumSet.noneOf(AutomationTrigger.class)));
    }

    private static int maxAbsOffset(List<AutomationRule> rules) {
        int max = rules.stream()
            .mapToInt(rule -> Math.abs(AutomationEvaluationService.effectiveOffsetDays(rule)))
            .max().orElse(0);
        return Math.min(max, MAX_SWEEP_WINDOW_DAYS);
    }
}
