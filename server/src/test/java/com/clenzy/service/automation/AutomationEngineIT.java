package com.clenzy.service.automation;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationExecutionStatus;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.CleaningFrequency;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ServiceRequestService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests d'integration du registre central d'automatisations (fiche 08 /
 * strategie de tests vague T1) : des {@link AutomationRule} REELLES en base,
 * {@code fireTrigger} sur le SPI {@link AutomationEngine}, et des assertions
 * sur les EFFETS persistes (ServiceRequest, AutomationExecution) — executeurs
 * reels, pas de mocks du moteur.
 *
 * <p>Couvre : creation du menage post-checkout (F1a), idempotence one-shot
 * (re-livraison = zero doublon), absence de dedup moteur pour les declencheurs
 * recurrents (INVOICE_OVERDUE — la cle metier de l'executeur prend le relais),
 * persistance EXECUTED/SKIPPED, conditions numeriques (alertsLast24h) et
 * etancheite cross-organisation.</p>
 */
@Transactional
@Rollback
class AutomationEngineIT extends AbstractIntegrationTest {

    private static final LocalDate CHECK_IN = LocalDate.of(2027, 8, 10);
    private static final LocalDate CHECK_OUT = LocalDate.of(2027, 8, 14);

    @Autowired private AutomationEngine automationEngine;
    @Autowired private AutomationRuleRepository ruleRepository;
    @Autowired private AutomationExecutionRepository executionRepository;
    @Autowired private ServiceRequestRepository serviceRequestRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private Clock clock;

    private Long orgAId;
    private Long orgBId;
    private Property propertyA;
    private Reservation reservationA;

    @BeforeEach
    void createTestData() {
        Organization orgA = organizationRepository.save(
            new Organization("Automation Org A", OrganizationType.INDIVIDUAL, "automation-org-a"));
        orgAId = orgA.getId();
        Organization orgB = organizationRepository.save(
            new Organization("Automation Org B", OrganizationType.INDIVIDUAL, "automation-org-b"));
        orgBId = orgB.getId();

        User ownerA = new User("Alice", "Automation", "alice.automation@test.com", "password123");
        ownerA.setOrganizationId(orgAId);
        ownerA.setKeycloakId("kc-automation-a");
        userRepository.save(ownerA);

        propertyA = new Property("Loft Automation", "1 rue des Flux", 2, 1, ownerA);
        propertyA.setOrganizationId(orgAId);
        propertyA.setNightlyPrice(new BigDecimal("90.00"));
        propertyA.setCleaningBasePrice(new BigDecimal("45.00"));
        propertyA.setCleaningFrequency(CleaningFrequency.AFTER_EACH_STAY);
        propertyRepository.save(propertyA);

        reservationA = new Reservation(propertyA, "Guest Flux", CHECK_IN, CHECK_OUT, "confirmed", "MANUAL");
        reservationA.setOrganizationId(orgAId);
        // saveAndFlush : Hibernate DIFFERE l'insert IDENTITY des entites versionnees
        // (@Version) dans une transaction — sans flush, getId() reste null.
        reservationA = reservationRepository.saveAndFlush(reservationA);
    }

    // ── (a) RESERVATION_BOOKED → menage post-checkout + dedup one-shot ─────────

    @Test
    void bookedTrigger_createsCleaningRequestAtCheckout_andRedeliveryCreatesNoDuplicate() {
        AutomationRule rule = cleaningRule(orgAId, null);

        automationEngine.fireTrigger(AutomationTrigger.RESERVATION_BOOKED, orgAId,
            reservationSubject(reservationA));

        String key = ServiceRequestService.buildAutoCleaningKey(propertyA.getId(), CHECK_IN, CHECK_OUT);
        Optional<ServiceRequest> sr = serviceRequestRepository.findByAutoFlowKey(key, orgAId);
        assertTrue(sr.isPresent(), "La demande de menage automatique doit etre creee");
        assertNotNull(sr.get().getDesiredDate());
        assertEquals(CHECK_OUT, sr.get().getDesiredDate().toLocalDate(),
            "Le menage doit etre planifie au jour du check-out");

        List<AutomationExecution> executions = executionsOf(rule);
        assertEquals(1, executions.size());
        assertEquals(AutomationExecutionStatus.EXECUTED, executions.get(0).getStatus());

        // Re-livraison Kafka simulee : MEME sujet re-declenche → dedup one-shot.
        automationEngine.fireTrigger(AutomationTrigger.RESERVATION_BOOKED, orgAId,
            reservationSubject(reservationA));

        assertEquals(1, executionsOf(rule).size(), "Une seule execution apres re-livraison (dedup one-shot)");
        assertEquals(1, cleaningRequestCount(orgAId), "Une seule demande de menage apres re-livraison");
    }

    // ── (b) Declencheur RECURRENT : pas de dedup moteur ────────────────────────

    @Test
    void recurringInvoiceOverdue_runsThroughEngineTwice_executorKeyTakesOver() {
        Invoice invoice = overdueInvoice(orgAId, 5);
        AutomationRule rule = rule(orgAId, AutomationTrigger.INVOICE_OVERDUE,
            AutomationAction.SEND_INVOICE_REMINDER, null);

        AutomationSubject subject = new AutomationSubject(AutomationSubject.TYPE_INVOICE,
            invoice.getId(), Map.of(AutomationSubject.DATA_DAYS_OVERDUE, 5L));

        automationEngine.fireTrigger(AutomationTrigger.INVOICE_OVERDUE, orgAId, subject);
        automationEngine.fireTrigger(AutomationTrigger.INVOICE_OVERDUE, orgAId, subject);

        List<AutomationExecution> executions = executionsOf(rule);
        assertEquals(2, executions.size(),
            "INVOICE_OVERDUE est recurrent : le moteur ne deduplique pas, 2 executions attendues");
        // 1er passage : relance J+3 envoyee (EXECUTED). 2e passage : la cle metier
        // de l'executeur (compteur + anti-rafale 24 h en base) prend le relais → SKIPPED.
        assertEquals(1, executions.stream()
            .filter(e -> e.getStatus() == AutomationExecutionStatus.EXECUTED).count());
        assertEquals(1, executions.stream()
            .filter(e -> e.getStatus() == AutomationExecutionStatus.SKIPPED).count());
        assertEquals(1, invoiceRepository.findById(invoice.getId()).orElseThrow()
            .getOverdueReminderCount(), "Une seule relance reellement consommee");
    }

    // ── (c) Resultat skipped persiste en SKIPPED (visible en UI) ───────────────

    @Test
    void skippedOutcome_persistedAsSkippedWithReason() {
        User ownerA = propertyA.getOwner();
        Property weekly = new Property("Villa Hebdo", "2 rue des Flux", 3, 2, ownerA);
        weekly.setOrganizationId(orgAId);
        weekly.setCleaningFrequency(CleaningFrequency.WEEKLY); // pas AFTER_EACH_STAY → skip metier
        propertyRepository.save(weekly);
        Reservation reservation = new Reservation(weekly, "Guest Hebdo",
            CHECK_IN, CHECK_OUT, "confirmed", "MANUAL");
        reservation.setOrganizationId(orgAId);
        reservation = reservationRepository.saveAndFlush(reservation);

        AutomationRule rule = cleaningRule(orgAId, null);

        automationEngine.fireTrigger(AutomationTrigger.RESERVATION_BOOKED, orgAId,
            reservationSubject(reservation));

        List<AutomationExecution> executions = executionsOf(rule);
        assertEquals(1, executions.size());
        assertEquals(AutomationExecutionStatus.SKIPPED, executions.get(0).getStatus());
        assertNotNull(executions.get(0).getErrorMessage(), "La raison du skip doit etre persistee");
        assertTrue(executions.get(0).getErrorMessage().contains("frequence"),
            "Raison inattendue : " + executions.get(0).getErrorMessage());
        assertEquals(0, cleaningRequestCount(orgAId), "Aucune demande de menage pour une frequence WEEKLY");
    }

    // ── (d) Conditions numeriques sur les data du sujet (F6b) ──────────────────

    @Test
    void numericCondition_alertsLast24hGte3_gatesExecution() {
        AutomationRule rule = rule(orgAId, AutomationTrigger.NOISE_ALERT,
            AutomationAction.NOTIFY_STAFF, "{\"alertsLast24h\": {\"gte\": 3}}");

        // 2 alertes en 24 h : condition non satisfaite → AUCUNE execution creee.
        automationEngine.fireTrigger(AutomationTrigger.NOISE_ALERT, orgAId,
            noiseSubject(9001L, 2));
        assertEquals(0, executionsOf(rule).size());

        // 3 alertes : seuil atteint → execution EXECUTED.
        automationEngine.fireTrigger(AutomationTrigger.NOISE_ALERT, orgAId,
            noiseSubject(9002L, 3));
        List<AutomationExecution> executions = executionsOf(rule);
        assertEquals(1, executions.size());
        assertEquals(AutomationExecutionStatus.EXECUTED, executions.get(0).getStatus());
        assertEquals(9002L, executions.get(0).getSubjectId());
    }

    // ── (e) Etancheite cross-organisation ──────────────────────────────────────

    @Test
    void crossOrgSubject_isRejected_noEffectPersisted() {
        AutomationRule ruleB = cleaningRule(orgBId, null);

        // Declenchement au nom de l'org B sur une reservation de l'org A :
        // l'ownership check du moteur (findById contourne le filtre Hibernate) refuse.
        assertThrows(AccessDeniedException.class, () ->
            automationEngine.fireTrigger(AutomationTrigger.RESERVATION_BOOKED, orgBId,
                reservationSubject(reservationA)));

        assertEquals(0, executionsOf(ruleB).size(), "Aucune execution persistee pour l'org B");
        assertEquals(0, cleaningRequestCount(orgBId), "Aucun effet cross-org");
        String key = ServiceRequestService.buildAutoCleaningKey(propertyA.getId(), CHECK_IN, CHECK_OUT);
        assertFalse(serviceRequestRepository.findByAutoFlowKey(key, orgBId).isPresent());
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private AutomationRule cleaningRule(Long orgId, String conditions) {
        return rule(orgId, AutomationTrigger.RESERVATION_BOOKED,
            AutomationAction.CREATE_CLEANING_REQUEST, conditions);
    }

    private AutomationRule rule(Long orgId, AutomationTrigger trigger,
                                AutomationAction action, String conditions) {
        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgId);
        rule.setName("IT " + trigger + " -> " + action);
        rule.setEnabled(true);
        rule.setTriggerType(trigger);
        rule.setActionType(action);
        rule.setConditions(conditions);
        return ruleRepository.save(rule);
    }

    /** Sujet RESERVATION tel que pose par DeterministicFlowListener (payload capteur calendrier). */
    private AutomationSubject reservationSubject(Reservation reservation) {
        Map<String, Object> data = new HashMap<>();
        data.put(AutomationSubject.DATA_PROPERTY_ID, reservation.getProperty().getId());
        data.put(AutomationSubject.DATA_RESERVATION_ID, reservation.getId());
        data.put(AutomationSubject.DATA_CHECK_IN, reservation.getCheckIn().toString());
        data.put(AutomationSubject.DATA_CHECK_OUT, reservation.getCheckOut().toString());
        return new AutomationSubject(AutomationSubject.TYPE_RESERVATION, reservation.getId(), data);
    }

    private AutomationSubject noiseSubject(Long alertId, int alertsLast24h) {
        return new AutomationSubject(AutomationSubject.TYPE_NOISE_ALERT, alertId, Map.of(
            AutomationSubject.DATA_PROPERTY_ID, propertyA.getId(),
            AutomationSubject.DATA_ALERTS_LAST_24H, alertsLast24h));
    }

    private Invoice overdueInvoice(Long orgId, int daysOverdue) {
        Invoice invoice = new Invoice();
        invoice.setOrganizationId(orgId);
        invoice.setInvoiceNumber("IT-AUTO-0001");
        invoice.setInvoiceDate(LocalDate.now(clock).minusDays(daysOverdue + 10L));
        invoice.setDueDate(LocalDate.now(clock).minusDays(daysOverdue));
        invoice.setTotalHt(new BigDecimal("100.00"));
        invoice.setTotalTax(new BigDecimal("20.00"));
        invoice.setTotalTtc(new BigDecimal("120.00"));
        invoice.setStatus(InvoiceStatus.OVERDUE);
        return invoiceRepository.save(invoice);
    }

    private List<AutomationExecution> executionsOf(AutomationRule rule) {
        return executionRepository
            .findByAutomationRuleIdAndOrganizationIdOrderByCreatedAtDesc(
                rule.getId(), rule.getOrganizationId(), Pageable.unpaged())
            .getContent();
    }

    private long cleaningRequestCount(Long orgId) {
        return serviceRequestRepository.findAll().stream()
            .filter(sr -> orgId.equals(sr.getOrganizationId()))
            .filter(sr -> sr.getAutoFlowKey() != null)
            .count();
    }
}
