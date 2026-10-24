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
 * Baitly automation admission and durable recovery. Evaluation only queues work in its
 * business transaction. The drain commits a STARTED fence before invoking an executor.
 * Uncertain and historical attempts require reconciliation, never automatic replay.
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

    private final com.clenzy.service.automation.BaitlyAutomationContext recoveryContext;
    private final com.clenzy.service.automation.BaitlyAutomationJournal journal;
    private final org.springframework.transaction.support.TransactionTemplate actionTransaction;
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
    private final com.clenzy.repository.GuestMessageLogRepository guestMessageLogRepository;

    public AutomationEvaluationService(AutomationRuleRepository ruleRepository,
                                        AutomationExecutionRepository executionRepository,
                                        AutomationConditionEvaluator conditionEvaluator,
                                        AutomationActionRegistry actionRegistry,
                                        ReservationRepository reservationRepository,
                                        TenantScopedExecutor tenantScopedExecutor,
                                        TenantContext tenantContext,
                                        MeterRegistry meterRegistry,
                                        SupervisionActivityService supervisionActivityService,
                                        Clock clock,
                                        com.clenzy.repository.GuestMessageLogRepository guestMessageLogRepository,
                                        com.clenzy.service.automation.BaitlyAutomationContext recoveryContext,
                                        com.clenzy.service.automation.BaitlyAutomationJournal journal,
                                        org.springframework.transaction.PlatformTransactionManager manager) {
        this.recoveryContext=recoveryContext; this.journal=journal;
        this.actionTransaction=new org.springframework.transaction.support.TransactionTemplate(manager);
        this.actionTransaction.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.actionTransaction.setTimeout(60);
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
        this.guestMessageLogRepository = guestMessageLogRepository;
    }

    // ── Chemin evenementiel (SPI AutomationEngine) ──────────────────────────────

    /**
     * {@inheritDoc}
     *
     * <p>Admission durable ({@code triggerOffsetDays}/{@code triggerTime} ne s'appliquent
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

            for (AutomationRule candidate : rules.stream().sorted(java.util.Comparator.comparing(AutomationRule::getId)).toList()) {
                AutomationRule rule=ruleRepository.lockForAdmission(candidate.getId(),orgId).orElse(null);
                if(rule==null || !rule.isEnabled() || rule.getTriggerType()!=trigger) continue;
                // One-shot subjects and recurring occurrences use distinct durable deduplication keys.
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
                enqueue(execution, rule, context.data());
            }
        });
    }

    /** An attempted or historical failure cannot prove absence of effects. Never re-arm it. */
    @Transactional(readOnly = true)
    public void replayExecution(Long executionId, Long orgId) {
        executionRepository.findById(executionId).filter(e -> orgId.equals(e.getOrganizationId()))
            .orElseThrow(() -> new IllegalArgumentException("Execution introuvable"));
        throw new IllegalStateException("AUTOMATION_RECONCILIATION_REQUIRED");
    }

    /**
     * Amorce les automatisations du cycle de vie d'une reservation a sa creation.
     *
     * <p>F1b : le declencheur RESERVATION_CONFIRMED est evenementiel — il s'execute ici,
     * par mise en file dans la transaction de creation, via
     * {@link BaitlyReservationAutomationStarter}, puis traitée par le drain rapide du scheduler.
     * Les declencheurs temporels sont
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
        if (reservation.isMigrationAutomationPaused()) return;
        List<AutomationRule> rules = ruleRepository
            .findByOrganizationIdAndTriggerTypeAndEnabledTrue(orgId, trigger);

        if(!orgId.equals(reservation.getOrganizationId())) throw new AccessDeniedException("AUTOMATION_SCOPE_REVIEW");
        for (AutomationRule candidate : rules.stream().sorted(java.util.Comparator.comparing(AutomationRule::getId)).toList()) {
            AutomationRule rule=ruleRepository.lockForAdmission(candidate.getId(),orgId).orElse(null);
            if(rule==null || !rule.isEnabled() || rule.getTriggerType()!=trigger) continue;
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
            enqueue(execution, rule, Map.of());
        }
    }

    /** Only committed, never-attempted work can be drained after a restart. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    public void processScheduledExecutions() {
        for(var work : journal.due(now())) {
            try {
                withTenantScope(work.org(), () -> {
                    var ticket=journal.claim(work,now());
                    if(ticket.isEmpty()) return;
                    AutomationActionExecutor.ExecutionResult result=null;
                    boolean allowDeferral=false;
                    AutomationAction action=null;
                    try {
                        var prepared=actionTransaction.execute(status -> prepare(work));
                        if(prepared!=null) {
                            // No engine transaction may surround a provider or an executor.
                            result=prepared.terminal()!=null?prepared.terminal():prepared.executor().execute(prepared.rule(),prepared.context());
                            allowDeferral=prepared.executor()!=null && prepared.executor().permitsPreEffectDeferral();
                            action=prepared.rule().getActionType();
                            if(result!=null && !result.skipped() && result.rescheduledAt()==null) {
                                try { recordConstellationActivity(prepared.rule(),prepared.context(),result.refId()); }
                                catch(RuntimeException ignored) { log.warn("Baitly automation: activite secondaire non confirmee"); }
                            }
                        }
                    } catch(RuntimeException failure) {
                        log.warn("Baitly automation: resultat incertain, execution={}, aucun rejeu automatique",work.execution());
                    }
                    boolean committed=journal.finish(ticket.orElseThrow(),result,now(),allowDeferral);
                    if(committed && result!=null && !result.skipped() && result.rescheduledAt()==null)
                        meterRegistry.counter(EXECUTED_METRIC,"action",action.name()).increment();
                });
            } catch(RuntimeException failure) {
                log.warn("Baitly automation: reprise interrompue, execution={}, tentative protegee",work.execution());
            }
        }
    }
    private Prepared prepare(com.clenzy.service.automation.BaitlyAutomationJournal.Work work) {
        AutomationExecution execution=executionRepository.findById(work.execution()).orElseThrow();
        AutomationRule rule=execution.getAutomationRule();
        if(!Long.valueOf(work.org()).equals(execution.getOrganizationId())
                || !Long.valueOf(work.org()).equals(rule.getOrganizationId()) || !rule.isEnabled()
                || !sameRevision(rule.getUpdatedAt(),execution.getRuleRevision()))
            throw new IllegalStateException("AUTOMATION_SCOPE_REVIEW");
        var data=recoveryContext.decode(work.org(),execution.getSubjectType(),execution.getSubjectId(),execution.getDurableContext());
        var subject=new AutomationSubject(execution.getSubjectType(),execution.getSubjectId(),data);
        Reservation stay=resolveReservationSubject(subject,work.org());
        validateStayRelations(stay,work.org());
        if(AutomationSubject.TYPE_RESERVATION.equals(subject.subjectType()) && stay==null)
            return new Prepared(rule,null,null,AutomationActionExecutor.ExecutionResult.skipped("SUBJECT_UNAVAILABLE"));
        if(stay!=null && "cancelled".equalsIgnoreCase(stay.getStatus())
                && rule.getTriggerType()!=AutomationTrigger.RESERVATION_CANCELLED)
            return new Prepared(rule,null,null,AutomationActionExecutor.ExecutionResult.skipped("SUBJECT_CANCELLED"));
        if(stay!=null && (!String.valueOf(stay.getProperty()==null?null:stay.getProperty().getId()).equals(data.get("_baitlyProperty"))
            || !String.valueOf(stay.getGuest()==null?null:stay.getGuest().getId()).equals(data.get("_baitlyGuest"))
            || !guestVersion(stay).equals(data.get("_baitlyGuestVersion"))))
            throw new IllegalStateException("AUTOMATION_SCOPE_REVIEW");
        var context=new AutomationActionContext(work.org(),subject.subjectType(),subject.subjectId(),data,stay);
        boolean match=stay!=null?conditionEvaluator.matches(rule.getConditions(),stay)
            :conditionEvaluator.matchesSubjectData(rule.getConditions(),data);
        if(!match) return new Prepared(rule,context,null,AutomationActionExecutor.ExecutionResult.skipped("CONDITION_CHANGED"));
        var executor=actionRegistry.executorFor(rule.getActionType());
        return new Prepared(rule,context,executor,null);
    }
    private record Prepared(AutomationRule rule, AutomationActionContext context, AutomationActionExecutor executor,
                            AutomationActionExecutor.ExecutionResult terminal) {}
    private static boolean sameRevision(LocalDateTime left,LocalDateTime right) {
        return left==null?right==null:right!=null && left.truncatedTo(java.time.temporal.ChronoUnit.MICROS)
            .equals(right.truncatedTo(java.time.temporal.ChronoUnit.MICROS));
    }
    private static String guestVersion(Reservation stay) {
        LocalDateTime version=stay.getGuest()==null?null:stay.getGuest().getUpdatedAt();
        // Match the rounding of PostgreSQL TIMESTAMP(6) for a guest saved by the producer.
        return version==null?"null":version.plusNanos(500).truncatedTo(java.time.temporal.ChronoUnit.MICROS).toString();
    }
    private static void validateStayRelations(Reservation stay, Long org) {
        if(stay==null) return;
        if((stay.getProperty()!=null && !org.equals(stay.getProperty().getOrganizationId()))
            || (stay.getGuest()!=null && !org.equals(stay.getGuest().getOrganizationId())))
            throw new AccessDeniedException("AUTOMATION_SCOPE_REVIEW");
    }
    private void enqueue(AutomationExecution execution, AutomationRule rule, Map<String,Object> input) {
        var captured=new java.util.HashMap<String,Object>(input);
        Reservation stay=execution.getReservation();
        validateStayRelations(stay,execution.getOrganizationId());
        if(stay!=null) {
            captured.put("_baitlyProperty",String.valueOf(stay.getProperty()==null?null:stay.getProperty().getId()));
            captured.put("_baitlyGuest",String.valueOf(stay.getGuest()==null?null:stay.getGuest().getId()));
            captured.put("_baitlyGuestVersion",guestVersion(stay));
        }
        var data=recoveryContext.freeze(rule,captured);
        String key=recoveryContext.key(rule,execution.getSubjectType(),execution.getSubjectId(),data);
        if(executionRepository.existsByAutomationRuleIdAndOrganizationIdAndSubjectTypeAndSubjectIdAndStatusAndDurableStateIsNull(
                rule.getId(),execution.getOrganizationId(),execution.getSubjectType(),execution.getSubjectId(),AutomationExecutionStatus.FAILED)
            || executionRepository.existsByDurableKey(key)
            || executionRepository.existsByAutomationRuleIdAndOrganizationIdAndSubjectTypeAndSubjectIdAndDurableStateIn(
                rule.getId(),execution.getOrganizationId(),execution.getSubjectType(),execution.getSubjectId(),List.of("STARTED","UNKNOWN"))) return;
        execution.setDurableKey(key);execution.setDurableState("PENDING");
        execution.setRuleRevision(rule.getUpdatedAt());
        execution.setDurableExpiresAt(rule.getTriggerType()==AutomationTrigger.NOISE_ALERT
            ? execution.getScheduledAt().plusMinutes(15):execution.getScheduledAt().plusDays(1));
        execution.setDurableContext(recoveryContext.encode(execution.getOrganizationId(),execution.getSubjectType(),execution.getSubjectId(),data));
        executionRepository.save(execution);
    }

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

    /**
     * Reflète un flux déterministe EXÉCUTÉ dans la constellation (journal + statut du
     * domaine), pour que le superviseur ne montre pas QUE l'activité du scan LLM.
     * Best-effort et per-propriété : on écrit seulement quand le sujet résout une
     * propriété (réservation ou sujet PROPERTY) — les sujets org-level (relevé,
     * payout) restent hors constellation. {@code recordModuleAct} avale ses erreurs.
     */
    private void recordConstellationActivity(AutomationRule rule, AutomationActionContext context,
                                             Long messageLogId) {
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
        // messageLogId présent uniquement pour les envois de message guest → permet de
        // prévisualiser le contenu envoyé depuis le journal de la constellation.
        // Un envoi FAILED (« pas de destinataire », erreur SMTP…) est marqué comme tel
        // dans le feed (toolName suffixé _FAILED + motif) — avant, il apparaissait
        // comme un envoi abouti banal, invisible en tant qu'échec.
        String toolName = rule.getActionType().name();
        String summary = "Automatisation Baitly : " + rule.getActionType().name();
        if (messageLogId != null) {
            try {
                var sentLog = guestMessageLogRepository.findById(messageLogId).orElse(null);
                if (sentLog != null && sentLog.getStatus() == com.clenzy.model.MessageStatus.FAILED) {
                    toolName = toolName + "_FAILED";
                    summary = "AUTOMATION_DELIVERY_UNCONFIRMED";
                }
            } catch (Exception ignore) {
                // best-effort : le feed reste renseigné avec le libellé nominal
            }
        }
        supervisionActivityService.recordModuleAct(
            context.orgId(), propertyId, module, toolName, summary, messageLogId);
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
        if (reservation == null || reservation.isMigrationAutomationPaused()) {
            return null;
        }
        if (!orgId.equals(reservation.getOrganizationId())) {
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
