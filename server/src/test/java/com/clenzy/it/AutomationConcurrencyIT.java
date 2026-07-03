package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationExecutionStatus;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.CleaningFrequency;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OwnerStatementDispatchRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.OwnerStatementService;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.SendOwnerStatementExecutor;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Concurrence du registre central des flux deterministes (vague T3) : deux
 * evenements STRICTEMENT simultanes (2 threads + barriere) ne produisent jamais
 * de double effet metier.
 *
 * <p>(a) 2 {@code fireTrigger} simultanes sur le MEME sujet one-shot : la dedup
 * moteur ({@code existsBy...}) est un check-then-act — c'est le filet METIER
 * (index unique {@code service_requests.auto_flow_key}, migration 0307, +
 * catch {@code DataIntegrityViolationException} dans
 * {@link ServiceRequestService#createAutomaticCleaningRequest}) qui garantit
 * l'invariant : UNE seule demande de menage, UNE seule execution EXECUTED.
 * (Nota : il n'existe volontairement PAS de contrainte unique sur
 * {@code automation_executions(rule, subject_type, subject_id)} — les
 * declencheurs RECURRENTS (relances factures) ecrivent plusieurs lignes pour le
 * meme couple ; l'index 0305 est non-unique par design.)</p>
 *
 * <p>(b) 2 creations simultanees du menage auto pour le MEME sejour (appel
 * direct service, chemin moteur + filet backfill) : une seule SR — la course
 * est tranchee par l'index unique, le perdant sort en {@code skipped}.</p>
 *
 * <p>(c) 2 {@code fireTrigger} OWNER_MONTHLY_STATEMENT simultanes pour le MEME
 * (owner, periode) : le claim {@code owner_statement_dispatch} (contrainte
 * unique 0306) est pose DANS la transaction du moteur — sans verrou advisory,
 * le perdant percuterait la contrainte, sa transaction serait marquee
 * rollback-only par le {@code save()} et le catch de l'executeur ne pourrait
 * plus la sauver ({@code UnexpectedRollbackException} au commit, meme bug que
 * le menage auto). Invariant : UN claim, UN envoi, zero exception.
 * {@link OwnerStatementService} est mocke : le test cible la course sur le
 * claim, pas l'email.</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
class AutomationConcurrencyIT extends AbstractIntegrationTest {

    private static final LocalDate CHECK_IN = LocalDate.of(2027, 9, 10);
    private static final LocalDate CHECK_OUT = LocalDate.of(2027, 9, 14);
    private static final LocalDate PERIOD_START = LocalDate.of(2027, 8, 1);
    private static final LocalDate PERIOD_END = LocalDate.of(2027, 8, 31);

    @Autowired private AutomationEngine automationEngine;
    @Autowired private ServiceRequestService serviceRequestService;
    @Autowired private TenantScopedExecutor tenantScopedExecutor;

    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private AutomationRuleRepository ruleRepository;
    @Autowired private AutomationExecutionRepository executionRepository;
    @Autowired private ServiceRequestRepository serviceRequestRepository;
    @Autowired private OwnerStatementDispatchRepository dispatchRepository;

    /** Neutralise l'envoi d'email reel (pas de SMTP en IT) : le test (c) cible le claim. */
    @MockBean private OwnerStatementService ownerStatementService;

    private Long orgId;
    private User owner;
    private Property property;
    private Reservation reservation;

    @BeforeEach
    void seed() {
        String salt = UUID.randomUUID().toString().substring(0, 8);
        orgId = organizationRepository.save(new Organization(
                "Concurrency " + salt, OrganizationType.INDIVIDUAL, "concurrency-" + salt)).getId();

        owner = new User("Cora", "Concurrent", "cora." + salt + "@test.com", "password123");
        owner.setOrganizationId(orgId);
        owner.setKeycloakId("kc-conc-" + salt);
        owner = userRepository.save(owner);

        property = new Property("Loft Barriere " + salt, "1 rue des Threads", 2, 1, owner);
        property.setOrganizationId(orgId);
        property.setNightlyPrice(new BigDecimal("100.00"));
        property.setCleaningBasePrice(new BigDecimal("40.00"));
        property.setCleaningFrequency(CleaningFrequency.AFTER_EACH_STAY);
        property = propertyRepository.save(property);

        reservation = new Reservation(property, "Guest Threads",
                CHECK_IN, CHECK_OUT, "confirmed", "MANUAL");
        reservation.setOrganizationId(orgId);
        reservation = reservationRepository.save(reservation);
    }

    // ─── (a) 2 fireTrigger simultanes, meme sujet one-shot ──────────────────

    @Test
    void twoSimultaneousFireTriggers_sameOneShotSubject_produceSingleCleaningRequestAndSingleExecuted()
            throws Exception {
        AutomationRule rule = cleaningRule();
        AutomationSubject subject = reservationSubject();

        List<Throwable> failures = runSimultaneously(2,
                () -> automationEngine.fireTrigger(AutomationTrigger.RESERVATION_BOOKED, orgId, subject));

        // Invariant METIER : une seule demande de menage pour le sejour.
        String key = ServiceRequestService.buildAutoCleaningKey(property.getId(), CHECK_IN, CHECK_OUT);
        List<ServiceRequest> requests = serviceRequestRepository.findAll().stream()
                .filter(sr -> key.equals(sr.getAutoFlowKey()))
                .toList();
        assertThat(requests)
                .as("Index unique 0307 : UNE seule demande de menage malgre 2 declenchements simultanes")
                .hasSize(1);

        // Invariant moteur : UNE seule execution EXECUTED pour la regle
        // (le perdant est SKIPPED — sa transaction persiste le statut — ou
        // rollback complet si Postgres a avorte sa transaction ; jamais 2 EXECUTED).
        List<AutomationExecution> executions = executionRepository
                .findByAutomationRuleIdAndOrganizationIdOrderByCreatedAtDesc(
                        rule.getId(), orgId, Pageable.unpaged())
                .getContent();
        assertThat(executions.stream()
                .filter(e -> e.getStatus() == AutomationExecutionStatus.EXECUTED).count())
                .as("Exactement UNE execution EXECUTED (executions=%s, echecs threads=%s)",
                        statuses(executions), failures)
                .isEqualTo(1);
        assertThat(executions.stream()
                .filter(e -> e.getStatus() == AutomationExecutionStatus.FAILED).count())
                .as("Aucune execution FAILED : la course perdue est un skip, pas une erreur")
                .isZero();

        // Re-livraison APRES la course (redelivery Kafka classique) : dedup moteur.
        automationEngine.fireTrigger(AutomationTrigger.RESERVATION_BOOKED, orgId, subject);
        assertThat(serviceRequestRepository.findAll().stream()
                .filter(sr -> key.equals(sr.getAutoFlowKey())).count()).isEqualTo(1);
    }

    // ─── (b) 2 creations simultanees du menage auto, meme sejour ────────────

    @Test
    void twoSimultaneousAutoCleaningCreations_sameStay_createSingleServiceRequest() throws Exception {
        AtomicInteger executed = new AtomicInteger();
        AtomicInteger skipped = new AtomicInteger();

        List<Throwable> failures = runSimultaneously(2, () ->
                tenantScopedExecutor.runAsOrganization(orgId, () -> {
                    var outcome = serviceRequestService.createAutomaticCleaningRequest(
                            orgId, property.getId(), CHECK_IN, CHECK_OUT, reservation.getId());
                    if (outcome.executed()) {
                        executed.incrementAndGet();
                    } else {
                        skipped.incrementAndGet();
                    }
                }));

        assertThat(failures)
                .as("Aucun thread ne doit lever : le perdant de la course sort en skipped")
                .isEmpty();
        assertThat(executed.get())
                .as("Un seul gagnant de la course (skipped=%s)", skipped.get())
                .isEqualTo(1);
        assertThat(skipped.get()).isEqualTo(1);

        String key = ServiceRequestService.buildAutoCleaningKey(property.getId(), CHECK_IN, CHECK_OUT);
        assertThat(serviceRequestRepository.findAll().stream()
                .filter(sr -> key.equals(sr.getAutoFlowKey())).count())
                .as("Cle unique 0307 : une seule SR pour le sejour")
                .isEqualTo(1);
    }

    // ─── (c) 2 releves proprietaire simultanes, meme (owner, periode) ───────

    @Test
    void twoSimultaneousOwnerStatementTriggers_samePeriod_produceSingleClaimAndSingleSend()
            throws Exception {
        AutomationRule rule = ownerStatementRule();
        AutomationSubject subject = ownerStatementSubject();

        List<Throwable> failures = runSimultaneously(2,
                () -> automationEngine.fireTrigger(
                        AutomationTrigger.OWNER_MONTHLY_STATEMENT, orgId, subject));

        assertThat(failures)
                .as("Le perdant de la course sort en SKIPPED via le verrou advisory — pas en "
                        + "UnexpectedRollbackException au commit de la transaction du moteur")
                .isEmpty();

        // Invariant METIER : UN seul claim (org, owner, periode) et UN seul envoi.
        assertThat(dispatchRepository.findAll().stream()
                .filter(d -> orgId.equals(d.getOrganizationId())
                        && owner.getId().equals(d.getOwnerId())
                        && PERIOD_START.equals(d.getPeriodStart()))
                .count())
                .as("Contrainte unique 0306 : UN seul claim malgre 2 declenchements simultanes")
                .isEqualTo(1);
        verify(ownerStatementService, times(1)).sendStatement(
                eq(owner.getId()), eq(orgId), eq(PERIOD_START), eq(PERIOD_END), any());

        // Invariant moteur : UNE seule execution EXECUTED, aucune FAILED (le perdant
        // est SKIPPED — sa transaction reste commitable grace au verrou advisory).
        List<AutomationExecution> executions = executionRepository
                .findByAutomationRuleIdAndOrganizationIdOrderByCreatedAtDesc(
                        rule.getId(), orgId, Pageable.unpaged())
                .getContent();
        assertThat(executions.stream()
                .filter(e -> e.getStatus() == AutomationExecutionStatus.EXECUTED).count())
                .as("Exactement UNE execution EXECUTED (executions=%s, echecs threads=%s)",
                        statuses(executions), failures)
                .isEqualTo(1);
        assertThat(executions.stream()
                .filter(e -> e.getStatus() == AutomationExecutionStatus.FAILED).count())
                .as("Aucune execution FAILED : la course perdue est un skip, pas une erreur")
                .isZero();

        // Re-declenchement APRES la course (tick scheduler suivant, re-livraison) :
        // l'idempotence par periode tient, pas de second envoi.
        automationEngine.fireTrigger(AutomationTrigger.OWNER_MONTHLY_STATEMENT, orgId, subject);
        verify(ownerStatementService, times(1)).sendStatement(
                eq(owner.getId()), eq(orgId), eq(PERIOD_START), eq(PERIOD_END), any());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Lance {@code parties} fois {@code task} sur des threads distincts, alignes
     * sur une {@link CyclicBarrier} (depart strictement simultane). Retourne les
     * exceptions levees par les threads (liste vide = tous OK).
     */
    private static List<Throwable> runSimultaneously(int parties, Runnable task) throws Exception {
        CyclicBarrier barrier = new CyclicBarrier(parties);
        CountDownLatch done = new CountDownLatch(parties);
        List<Throwable> failures = Collections.synchronizedList(new java.util.ArrayList<>());
        ExecutorService pool = Executors.newFixedThreadPool(parties);
        try {
            for (int i = 0; i < parties; i++) {
                pool.submit(() -> {
                    try {
                        barrier.await(10, TimeUnit.SECONDS);
                        task.run();
                    } catch (Throwable t) {
                        failures.add(t);
                    } finally {
                        done.countDown();
                    }
                });
            }
            assertThat(done.await(60, TimeUnit.SECONDS))
                    .as("Les threads concurrents doivent terminer sous 60 s (deadlock ?)")
                    .isTrue();
        } finally {
            pool.shutdownNow();
        }
        return failures;
    }

    private AutomationRule cleaningRule() {
        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgId);
        rule.setName("IT concurrence menage");
        rule.setEnabled(true);
        rule.setTriggerType(AutomationTrigger.RESERVATION_BOOKED);
        rule.setActionType(AutomationAction.CREATE_CLEANING_REQUEST);
        return ruleRepository.save(rule);
    }

    private AutomationRule ownerStatementRule() {
        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgId);
        rule.setName("IT concurrence releve proprietaire");
        rule.setEnabled(true);
        rule.setTriggerType(AutomationTrigger.OWNER_MONTHLY_STATEMENT);
        rule.setActionType(AutomationAction.SEND_OWNER_STATEMENT);
        return ruleRepository.save(rule);
    }

    private AutomationSubject ownerStatementSubject() {
        return new AutomationSubject(
                SendOwnerStatementExecutor.SUBJECT_OWNER,
                owner.getId(),
                Map.of(SendOwnerStatementExecutor.DATA_PERIOD_START, PERIOD_START.toString(),
                       SendOwnerStatementExecutor.DATA_PERIOD_END, PERIOD_END.toString()));
    }

    private AutomationSubject reservationSubject() {
        Map<String, Object> data = new HashMap<>();
        data.put(AutomationSubject.DATA_PROPERTY_ID, property.getId());
        data.put(AutomationSubject.DATA_RESERVATION_ID, reservation.getId());
        data.put(AutomationSubject.DATA_CHECK_IN, CHECK_IN.toString());
        data.put(AutomationSubject.DATA_CHECK_OUT, CHECK_OUT.toString());
        return new AutomationSubject(AutomationSubject.TYPE_RESERVATION, reservation.getId(), data);
    }

    private static List<AutomationExecutionStatus> statuses(List<AutomationExecution> executions) {
        return executions.stream().map(AutomationExecution::getStatus).toList();
    }
}
