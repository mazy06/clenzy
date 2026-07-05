package com.clenzy.service.messaging;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationExecutionStatus;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Reservation;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.access.StayTimes;
import com.clenzy.service.automation.AutomationActionContext;
import com.clenzy.service.automation.AutomationActionExecutor;
import com.clenzy.service.automation.AutomationActionRegistry;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.RevokeAccessCodeExecutor;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.tenant.TenantScopedExecutor;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

/**
 * Coeur du moteur d'automatisation (registre central des flux deterministes, fiche 08).
 *
 * <p>Deux chemins d'entree, un seul pipeline d'execution :</p>
 * <ul>
 *   <li><b>Temporel</b> — {@link #onReservationCreated} amorce les declencheurs du cycle de
 *       vie reservation (J-X / jour J / J+X, planification PENDING) ; le scheduler draine
 *       ({@link #processScheduledExecutions}) et re-evalue par sweep ;</li>
 *   <li><b>Evenementiel</b> — {@link #fireTrigger} (SPI {@link AutomationEngine}) appele par
 *       les capteurs (consumers Kafka, webhooks, crons), execution immediate.</li>
 * </ul>
 *
 * <p>Idempotence : pour les declencheurs one-shot ({@link AutomationTrigger#isDedupePerSubject()}),
 * au plus UNE {@link AutomationExecution} par (regle x subjectType x subjectId), verifiee avant
 * toute creation — re-livraison Kafka, sweep ou re-evaluation ne provoquent jamais de double
 * effet ; un statut FAILED est terminal pour ce couple (pas de retry automatique — visible en
 * UI, choix v1). Pour les declencheurs recurrents (releve mensuel, relances), l'idempotence
 * est portee par la cle metier de l'executeur.</p>
 *
 * <p>L'execution des actions est routee vers les beans {@code AutomationActionExecutor}
 * via {@link AutomationActionRegistry} ; chaque succes incremente la metrique
 * {@value AutomationEngine#EXECUTED_METRIC} taguee par action.</p>
 */
@Service
public class AutomationEvaluationService implements AutomationEngine {

    private static final Logger log = LoggerFactory.getLogger(AutomationEvaluationService.class);
    private static final LocalTime DEFAULT_TRIGGER_TIME = LocalTime.of(9, 0);

    /**
     * Mapping action déterministe → domaine de la constellation (com/rev/ops/fin/rep).
     * Permet à la constellation de refléter les flux SANS IA (feed + statut de domaine),
     * pas seulement le scan LLM. Une action absente = pas de ligne dans la constellation.
     */
    private static final Map<AutomationAction, String> ACTION_MODULE = Map.ofEntries(
        Map.entry(AutomationAction.SEND_MESSAGE, "com"),
        Map.entry(AutomationAction.SEND_GUIDE, "com"),
        Map.entry(AutomationAction.SEND_CHECKIN_LINK, "com"),
        Map.entry(AutomationAction.SEND_NOISE_WARNING, "com"),
        Map.entry(AutomationAction.SEND_REVIEW_REQUEST, "rep"),
        Map.entry(AutomationAction.CREATE_CLEANING_REQUEST, "ops"),
        Map.entry(AutomationAction.CANCEL_LINKED_CLEANING_REQUEST, "ops"),
        Map.entry(AutomationAction.CREATE_MAINTENANCE_INTERVENTION, "ops"),
        Map.entry(AutomationAction.NOTIFY_STAFF, "ops"),
        Map.entry(AutomationAction.REVOKE_ACCESS_CODE, "ops"),
        Map.entry(AutomationAction.SEND_INVOICE_REMINDER, "fin"),
        Map.entry(AutomationAction.SEND_OWNER_STATEMENT, "fin"),
        Map.entry(AutomationAction.SUGGEST_DEPOSIT_REFUND, "fin"),
        Map.entry(AutomationAction.SUGGEST_DEPOSIT_RELEASE, "fin"),
        Map.entry(AutomationAction.NOTIFY_RATE_PARITY, "rev"),
        Map.entry(AutomationAction.SUGGEST_CALENDAR_BLOCK, "rev")
    );

    private final AutomationRuleRepository ruleRepository;
    private final AutomationExecutionRepository executionRepository;
    private final AutomationConditionEvaluator conditionEvaluator;
    private final AutomationActionRegistry actionRegistry;
    private final ReservationRepository reservationRepository;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final TenantContext tenantContext;
    private final MeterRegistry meterRegistry;
    private final SupervisionActivityService supervisionActivityService;
    private final Clock clock;

    public AutomationEvaluationService(AutomationRuleRepository ruleRepository,
                                        AutomationExecutionRepository executionRepository,
                                        AutomationConditionEvaluator conditionEvaluator,
                                        AutomationActionRegistry actionRegistry,
                                        ReservationRepository reservationRepository,
                                        TenantScopedExecutor tenantScopedExecutor,
                                        TenantContext tenantContext,
                                        MeterRegistry meterRegistry,
                                        SupervisionActivityService supervisionActivityService,
                                        Clock clock) {
        this.ruleRepository = ruleRepository;
        this.executionRepository = executionRepository;
        this.conditionEvaluator = conditionEvaluator;
        this.actionRegistry = actionRegistry;
        this.reservationRepository = reservationRepository;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.tenantContext = tenantContext;
        this.meterRegistry = meterRegistry;
        this.supervisionActivityService = supervisionActivityService;
        this.clock = clock;
    }

    // ── Chemin evenementiel (SPI AutomationEngine) ──────────────────────────────

    /**
     * {@inheritDoc}
     *
     * <p>Execution immediate ({@code triggerOffsetDays}/{@code triggerTime} ne s'appliquent
     * qu'aux declencheurs temporels du cycle de vie reservation). Pour un sujet
     * {@code TYPE_RESERVATION}, la reservation est resolue ici (ownership org verifie —
     * {@code findById} contourne le filtre Hibernate) et fournie aux executeurs via le
     * contexte. Le contexte tenant est pose si le thread appelant (Kafka, cron) n'en a pas.</p>
     */
    @Override
    @Transactional
    public void fireTrigger(AutomationTrigger trigger, Long orgId, AutomationSubject subject) {
        List<AutomationRule> rules = ruleRepository
            .findByOrganizationIdAndTriggerTypeAndEnabledTrue(orgId, trigger);
        if (rules.isEmpty()) {
            return;
        }

        withTenantScope(orgId, () -> {
            Reservation reservation = resolveReservationSubject(subject, orgId);
            if (AutomationSubject.TYPE_RESERVATION.equals(subject.subjectType()) && reservation == null) {
                // Course event / purge : la reservation n'existe plus, aucun effet a produire.
                log.warn("fireTrigger {} org={} : reservation {} introuvable — aucune regle executee",
                    trigger, orgId, subject.subjectId());
                return;
            }
            AutomationActionContext context = new AutomationActionContext(
                orgId, subject.subjectType(), subject.subjectId(), subject.data(), reservation);

            for (AutomationRule rule : rules) {
                // Declencheur recurrent (releve mensuel, relance facture...) : pas de dedup
                // moteur — l'executeur porte sa cle metier (cf. AutomationTrigger).
                if (trigger.isDedupePerSubject()
                        && executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
                            rule.getId(), subject.subjectType(), subject.subjectId())) {
                    log.debug("Rule {} deja executee pour sujet {}/{}",
                        rule.getId(), subject.subjectType(), subject.subjectId());
                    continue;
                }
                boolean match = reservation != null
                    ? conditionEvaluator.matches(rule.getConditions(), reservation)
                    : conditionEvaluator.matchesSubjectData(rule.getConditions(), subject.data());
                if (!match) {
                    continue;
                }
                AutomationExecution execution = newExecution(rule, orgId,
                    subject.subjectType(), subject.subjectId(), reservation, now());
                executeAction(execution, rule, context);
            }
        });
    }

    // ── Chemin temporel (cycle de vie reservation) ──────────────────────────────

    /**
     * Amorce les automatisations du cycle de vie d'une reservation a sa creation.
     *
     * <p>F1b : le declencheur RESERVATION_CONFIRMED est evenementiel — il s'execute ici,
     * immediatement et de facon synchrone (appele par {@code ReservationService} apres
     * creation), pas au prochain tick du scheduler. Les declencheurs temporels sont
     * planifies (PENDING) pour leur date cible et draines par
     * {@link #processScheduledExecutions()}. Les reservations creees hors de ce chemin
     * (import iCal / OTA) sont rattrapees par le sweep temporel de
     * {@code AutomationSchedulerService} — sans message de bienvenue retroactif. Seuls
     * les declencheurs {@link AutomationTrigger#RESERVATION_LIFECYCLE} sont amorces :
     * les declencheurs evenementiels (bruit, facture...) n'ont pas de sens ici.</p>
     */
    @Transactional
    public void onReservationCreated(Reservation reservation, Long orgId) {
        for (AutomationTrigger trigger : AutomationTrigger.RESERVATION_LIFECYCLE) {
            evaluateRulesForReservation(reservation, trigger, orgId);
        }
    }

    @Transactional
    public void evaluateRulesForReservation(Reservation reservation, AutomationTrigger trigger, Long orgId) {
        List<AutomationRule> rules = ruleRepository
            .findByOrganizationIdAndTriggerTypeAndEnabledTrue(orgId, trigger);

        for (AutomationRule rule : rules) {
            if (executionRepository.existsByAutomationRuleIdAndSubjectTypeAndSubjectId(
                    rule.getId(), AutomationSubject.TYPE_RESERVATION, reservation.getId())) {
                log.debug("Rule {} deja executee pour reservation {}", rule.getId(), reservation.getId());
                continue;
            }

            if (!conditionEvaluator.matches(rule.getConditions(), reservation)) {
                log.debug("Rule {} ne matche pas les conditions pour reservation {}", rule.getId(), reservation.getId());
                continue;
            }

            LocalDateTime scheduledAt = calculateScheduledTime(reservation, rule);
            AutomationExecution execution = newExecution(rule, orgId,
                AutomationSubject.TYPE_RESERVATION, reservation.getId(), reservation, scheduledAt);

            // <= : une echeance egale a maintenant (RESERVATION_CONFIRMED) s'execute tout de
            // suite au lieu d'attendre le prochain tick horaire du drain.
            if (!scheduledAt.isAfter(now())) {
                executeAction(execution, rule,
                    AutomationActionContext.forReservation(orgId, reservation));
            } else {
                execution.setStatus(AutomationExecutionStatus.PENDING);
                executionRepository.save(execution);
                log.info("Automation {} planifiee pour {} (reservation {})",
                    rule.getName(), scheduledAt, reservation.getId());
            }
        }
    }

    /**
     * Draine les executions PENDING dont l'echeance est passee (appele par le scheduler,
     * hors contexte HTTP). Chaque execution tourne sous le contexte tenant de SON org
     * (Z2-EFFETS : TenantScopedExecutor, jamais de contexte nu hors HTTP). Le contexte
     * d'action est reconstruit depuis le sujet persiste — {@code data} volatile perdu,
     * par contrat du SPI.
     */
    @Transactional
    public void processScheduledExecutions() {
        List<AutomationExecution> pending = executionRepository
            .findByStatusAndScheduledAtBefore(AutomationExecutionStatus.PENDING, now());

        for (AutomationExecution execution : pending) {
            tenantScopedExecutor.runAsOrganization(execution.getOrganizationId(), () -> {
                AutomationActionContext context = new AutomationActionContext(
                    execution.getOrganizationId(), execution.getSubjectType(),
                    execution.getSubjectId(), Map.of(), execution.getReservation());
                executeAction(execution, execution.getAutomationRule(), context);
            });
        }

        if (!pending.isEmpty()) {
            log.info("Traitement de {} executions d'automatisation planifiees", pending.size());
        }
    }

    // ── Pipeline d'execution commun ─────────────────────────────────────────────

    private AutomationExecution newExecution(AutomationRule rule, Long orgId, String subjectType,
                                             Long subjectId, Reservation reservation,
                                             LocalDateTime scheduledAt) {
        AutomationExecution execution = new AutomationExecution();
        execution.setOrganizationId(orgId);
        execution.setAutomationRule(rule);
        execution.setSubjectType(subjectType);
        execution.setSubjectId(subjectId);
        execution.setReservation(reservation);
        execution.setScheduledAt(scheduledAt);
        return execution;
    }

    private void executeAction(AutomationExecution execution, AutomationRule rule,
                                AutomationActionContext context) {
        try {
            AutomationActionExecutor.ExecutionResult result =
                actionRegistry.executorFor(rule.getActionType()).execute(rule, context);
            if (result.rescheduledAt() != null) {
                // Guard temporel non atteint (ex. REVOKE_ACCESS_CODE avant check-out +
                // grace) : statut NON-terminal — l'execution repart en PENDING a la
                // nouvelle echeance et sera re-drainee. L'idempotence generique voit la
                // ligne existante : pas de doublon cree par le sweep entre-temps.
                execution.setStatus(AutomationExecutionStatus.PENDING);
                execution.setScheduledAt(result.rescheduledAt());
                execution.setErrorMessage(result.detail());
                log.info("Automation {} re-planifiee au {} pour sujet {}/{} : {}",
                    rule.getName(), result.rescheduledAt(),
                    context.subjectType(), context.subjectId(), result.detail());
            } else if (result.skipped()) {
                execution.setStatus(AutomationExecutionStatus.SKIPPED);
                execution.setErrorMessage(result.detail());
                log.info("Automation {} sautee pour sujet {}/{} : {}",
                    rule.getName(), context.subjectType(), context.subjectId(), result.detail());
            } else {
                execution.setStatus(AutomationExecutionStatus.EXECUTED);
                execution.setExecutedAt(now());
                meterRegistry.counter(EXECUTED_METRIC, "action", rule.getActionType().name()).increment();
                recordConstellationActivity(rule, context);
                log.info("Automation {} ({}) executee pour sujet {}/{}",
                    rule.getName(), rule.getActionType(), context.subjectType(), context.subjectId());
            }
        } catch (Exception e) {
            // Pas un catch avaleur : l'echec devient un statut FAILED persiste (visible dans
            // l'UI des executions de la regle, avec le message d'erreur) et n'empeche pas le
            // traitement des executions suivantes.
            execution.setStatus(AutomationExecutionStatus.FAILED);
            execution.setErrorMessage(e.getMessage());
            log.error("Erreur automation {} pour sujet {}/{}: {}",
                rule.getName(), context.subjectType(), context.subjectId(), e.getMessage(), e);
        }
        executionRepository.save(execution);
    }

    /**
     * Reflète un flux déterministe EXÉCUTÉ dans la constellation (journal + statut du
     * domaine), pour que le superviseur ne montre pas QUE l'activité du scan LLM.
     * Best-effort et per-propriété : on écrit seulement quand le sujet résout une
     * propriété (réservation ou sujet PROPERTY) — les sujets org-level (relevé,
     * payout) restent hors constellation. {@code recordModuleAct} avale ses erreurs.
     */
    private void recordConstellationActivity(AutomationRule rule, AutomationActionContext context) {
        String module = ACTION_MODULE.get(rule.getActionType());
        if (module == null) {
            return;
        }
        Long propertyId = null;
        try {
            if (context.reservation() != null && context.reservation().getProperty() != null) {
                propertyId = context.reservation().getProperty().getId();
            } else if (AutomationSubject.TYPE_PROPERTY.equals(context.subjectType())) {
                propertyId = context.subjectId();
            }
        } catch (Exception ignore) {
            propertyId = null; // propriété LAZY non résoluble → pas de ligne, best-effort
        }
        if (propertyId == null) {
            return;
        }
        supervisionActivityService.recordModuleAct(
            context.orgId(), propertyId, module, rule.getActionType().name(), rule.getName());
    }

    /**
     * Resout la reservation d'un sujet TYPE_RESERVATION (null pour les autres types).
     * Ownership (regle audit #3) : {@code findById} contourne le filtre Hibernate —
     * une reservation d'une autre org que celle du declenchement est refusee.
     */
    private Reservation resolveReservationSubject(AutomationSubject subject, Long orgId) {
        if (!AutomationSubject.TYPE_RESERVATION.equals(subject.subjectType())) {
            return null;
        }
        Reservation reservation = reservationRepository.findById(subject.subjectId()).orElse(null);
        if (reservation == null) {
            return null;
        }
        if (reservation.getOrganizationId() != null && !reservation.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Reservation " + subject.subjectId()
                + " hors de l'organisation " + orgId);
        }
        return reservation;
    }

    /**
     * Pose le contexte tenant si le thread appelant n'en a pas (capteur Kafka, cron) ;
     * reutilise le contexte existant si l'org correspond (appel depuis un flux deja scope).
     */
    private void withTenantScope(Long orgId, Runnable action) {
        if (orgId.equals(tenantContext.getOrganizationId())) {
            action.run();
            return;
        }
        tenantScopedExecutor.runAsOrganization(orgId, action);
    }

    /**
     * Echeance de la regle pour la reservation, calculee dans le fuseau DU LOGEMENT
     * (regle d'audit #9 — les J-X en zone serveur ont deja cause l'overbooking Z5-BUGS-08)
     * puis convertie en heure murale serveur : c'est la convention de stockage de
     * {@code scheduled_at}, conservee pour rester comparable aux executions PENDING
     * deja en base et au {@code now()} du drain.
     */
    private LocalDateTime calculateScheduledTime(Reservation reservation, AutomationRule rule) {
        // F4b : la revocation du code d'acces se planifie a l'HEURE EXACTE du depart
        // (heure de check-out de la reservation/du logement, fuseau du logement) + delai
        // de grace — pas au triggerTime generique de la regle. Le guard de l'executeur
        // (re-planification non-terminale) couvre un check-out deplace apres coup.
        if (rule.getActionType() == AutomationAction.REVOKE_ACCESS_CODE
                && (rule.getTriggerType() == AutomationTrigger.CHECK_OUT_DAY
                    || rule.getTriggerType() == AutomationTrigger.CHECK_OUT_PASSED)) {
            ZonedDateTime revocation = RevokeAccessCodeExecutor.revocationMoment(reservation, rule);
            if (revocation != null) {
                return revocation.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
            }
        }
        LocalDate baseDate = switch (rule.getTriggerType()) {
            case CHECK_IN_APPROACHING, CHECK_IN_DAY -> reservation.getCheckIn();
            case CHECK_OUT_DAY, CHECK_OUT_PASSED, REVIEW_REMINDER -> reservation.getCheckOut();
            // Declencheurs evenementiels (RESERVATION_CONFIRMED inclus) : pas de date de
            // sejour de reference — execution immediate. Idem si la date de sejour manque.
            default -> null;
        };
        if (baseDate == null) {
            return now();
        }

        LocalDate targetDate = baseDate.plusDays(effectiveOffsetDays(rule));
        LocalTime targetTime = StayTimes.parseTime(rule.getTriggerTime(), DEFAULT_TRIGGER_TIME);
        ZoneId propertyZone = StayTimes.zoneOf(reservation.getProperty());

        return targetDate.atTime(targetTime).atZone(propertyZone)
            .withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }

    /**
     * Offset applique a la date de base. Pour CHECK_IN_APPROACHING (« J-X avant l'arrivee »,
     * F3b), l'offset est une DISTANCE : -1 et 1 signifient tous deux J-1 — un declenchement
     * apres l'arrivee n'a pas de sens pour ce declencheur (les regles existantes utilisaient
     * deja des valeurs negatives, comportement inchange pour elles).
     */
    public static int effectiveOffsetDays(AutomationRule rule) {
        int offset = rule.getTriggerOffsetDays();
        if (rule.getTriggerType() == AutomationTrigger.CHECK_IN_APPROACHING) {
            return -Math.abs(offset);
        }
        return offset;
    }

    private LocalDateTime now() {
        // Meme referentiel (heure murale serveur) que les scheduled_at stockes.
        return LocalDateTime.ofInstant(clock.instant(), ZoneId.systemDefault());
    }
}
