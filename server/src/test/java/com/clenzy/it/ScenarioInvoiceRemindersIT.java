package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationExecution;
import com.clenzy.model.AutomationExecutionStatus;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Guest;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.AutomationExecutionRepository;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.scheduler.InvoiceOverdueScheduler;
import com.clenzy.service.EmailService;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Scenario S3 — relances de facture impayee : passage OVERDUE par le scheduler,
 * relance 1 a J+3, relance 2 a J+7, JAMAIS de 3e (compteur en base + garde
 * executeur + filtre du scheduler). Anti-rafale : jamais 2 relances < 24 h.
 *
 * <p>Le calcul {@code daysOverdue} du code de production repose sur
 * {@code LocalDate.now()} (pas le bean Clock) : la progression temporelle est
 * donc simulee en re-datant {@code overdueNotifiedAt}/{@code overdueLastReminderAt}
 * dans le passe — determinisme sans sleep.</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
class ScenarioInvoiceRemindersIT extends AbstractIntegrationTest {

    @Autowired private InvoiceOverdueScheduler invoiceOverdueScheduler;
    @Autowired private AutomationEngine automationEngine;

    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private GuestRepository guestRepository;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private AutomationRuleRepository ruleRepository;
    @Autowired private AutomationExecutionRepository executionRepository;

    @MockBean private EmailService emailService;

    private Long orgAId;
    private Long orgBId;
    private String salt;
    private Reservation reservation;

    @BeforeEach
    void seedInvoiceSetup() {
        salt = UUID.randomUUID().toString().substring(0, 8);
        orgAId = organizationRepository.save(new Organization(
                "Facturation A " + salt, OrganizationType.INDIVIDUAL, "invoice-a-" + salt)).getId();
        orgBId = organizationRepository.save(new Organization(
                "Facturation B " + salt, OrganizationType.INDIVIDUAL, "invoice-b-" + salt)).getId();

        User owner = new User("Fanny", "Facture", "fanny." + salt + "@test.com", "password123");
        owner.setOrganizationId(orgAId);
        owner.setKeycloakId("kc-inv-" + salt);
        owner = userRepository.save(owner);

        Property property = new Property("Gite Facture " + salt, "4 rue des Comptes", 2, 1, owner);
        property.setOrganizationId(orgAId);
        property.setNightlyPrice(new BigDecimal("100.00"));
        property = propertyRepository.save(property);

        Guest guest = new Guest("Paul", "Payeur", orgAId);
        guest.setEmail("paul.payeur@test.com");
        guest = guestRepository.save(guest);

        reservation = new Reservation();
        reservation.setOrganizationId(orgAId);
        reservation.setProperty(property);
        reservation.setCheckIn(LocalDate.now().minusDays(20));
        reservation.setCheckOut(LocalDate.now().minusDays(15));
        reservation.setStatus("confirmed");
        reservation.setGuest(guest);
        reservation = reservationRepository.save(reservation);

        // Regle SEND_INVOICE_REMINDER pour l'org A uniquement (zero-fuite org B).
        AutomationRule rule = new AutomationRule();
        rule.setOrganizationId(orgAId);
        rule.setName("Relance facture impayee");
        rule.setEnabled(true);
        rule.setTriggerType(AutomationTrigger.INVOICE_OVERDUE);
        rule.setActionType(AutomationAction.SEND_INVOICE_REMINDER);
        ruleRepository.save(rule);

        setupTenantContext(orgAId, false);
    }

    private Invoice seedInvoice(Long orgId, InvoiceStatus status, LocalDate dueDate, Long reservationId) {
        Invoice invoice = new Invoice();
        invoice.setOrganizationId(orgId);
        invoice.setInvoiceNumber("IT-" + salt + "-" + orgId + "-" + status);
        invoice.setInvoiceDate(LocalDate.now().minusDays(15));
        invoice.setDueDate(dueDate);
        invoice.setStatus(status);
        invoice.setTotalHt(new BigDecimal("100.00"));
        invoice.setTotalTax(new BigDecimal("20.00"));
        invoice.setTotalTtc(new BigDecimal("120.00"));
        invoice.setReservationId(reservationId);
        return invoiceRepository.save(invoice);
    }

    private List<AutomationExecution> reminderExecutions(Long orgId) {
        // Le rule du proxy est lazy et la session est fermee : on resout les ids
        // de regles par action AVANT de filtrer (jamais de deref du proxy).
        java.util.Set<Long> ruleIds = ruleRepository.findAll().stream()
                .filter(r -> r.getActionType() == AutomationAction.SEND_INVOICE_REMINDER)
                .map(AutomationRule::getId)
                .collect(java.util.stream.Collectors.toSet());
        return executionRepository.findAll().stream()
                .filter(e -> orgId.equals(e.getOrganizationId()))
                .filter(e -> e.getAutomationRule() != null
                        && ruleIds.contains(e.getAutomationRule().getId()))
                .toList();
    }

    @Test
    void overdueInvoice_firstReminderAtJPlus3_secondAtJPlus7_neverAThird() {
        // Facture impayee (SENT, echue hier) + facture jumelle org B sans regle.
        Invoice invoice = seedInvoice(orgAId, InvoiceStatus.SENT, LocalDate.now().minusDays(1),
                reservation.getId());
        Invoice invoiceB = seedInvoice(orgBId, InvoiceStatus.OVERDUE, LocalDate.now().minusDays(10), null);
        invoiceB.setOverdueNotifiedAt(LocalDateTime.now().minusDays(7));
        invoiceRepository.save(invoiceB);

        // ── J0 : le scheduler bascule la facture en OVERDUE. Trop tot pour relancer. ──
        invoiceOverdueScheduler.checkOverdueInvoices();
        Invoice refreshed = invoiceRepository.findById(invoice.getId()).orElseThrow();
        assertThat(refreshed.getStatus()).isEqualTo(InvoiceStatus.OVERDUE);
        assertThat(refreshed.getOverdueNotifiedAt()).isNotNull();
        assertThat(refreshed.getOverdueReminderCount()).isZero();

        // ── J+3 (simule en re-datant overdueNotifiedAt) : relance 1. ──
        refreshed.setOverdueNotifiedAt(LocalDateTime.now().minusDays(3));
        invoiceRepository.save(refreshed);
        invoiceOverdueScheduler.fireOverdueReminders();

        refreshed = invoiceRepository.findById(invoice.getId()).orElseThrow();
        assertThat(refreshed.getOverdueReminderCount()).isEqualTo(1);
        verify(emailService, times(1)).sendContactMessage(
                eq("paul.payeur@test.com"), anyString(), any(), any(), anyString(), anyString(), anyList());

        // ── Rejeu immediat : anti-rafale (< 24 h) → aucune 2e relance. ──
        invoiceOverdueScheduler.fireOverdueReminders();
        refreshed = invoiceRepository.findById(invoice.getId()).orElseThrow();
        assertThat(refreshed.getOverdueReminderCount()).isEqualTo(1);

        // ── J+3 < retard < J+7 (anti-rafale purge) : toujours pas de relance 2. ──
        refreshed.setOverdueLastReminderAt(LocalDateTime.now().minusDays(2));
        invoiceRepository.save(refreshed);
        invoiceOverdueScheduler.fireOverdueReminders();
        refreshed = invoiceRepository.findById(invoice.getId()).orElseThrow();
        assertThat(refreshed.getOverdueReminderCount()).isEqualTo(1);

        // ── J+7 : relance 2. ──
        refreshed.setOverdueNotifiedAt(LocalDateTime.now().minusDays(7));
        refreshed.setOverdueLastReminderAt(LocalDateTime.now().minusDays(2));
        invoiceRepository.save(refreshed);
        invoiceOverdueScheduler.fireOverdueReminders();

        refreshed = invoiceRepository.findById(invoice.getId()).orElseThrow();
        assertThat(refreshed.getOverdueReminderCount()).isEqualTo(2);
        verify(emailService, times(2)).sendContactMessage(
                eq("paul.payeur@test.com"), anyString(), any(), any(), anyString(), anyString(), anyList());

        // ── JAMAIS de 3e relance : ni par le scheduler (filtre count < 2)… ──
        refreshed.setOverdueLastReminderAt(LocalDateTime.now().minusDays(2));
        invoiceRepository.save(refreshed);
        invoiceOverdueScheduler.fireOverdueReminders();
        refreshed = invoiceRepository.findById(invoice.getId()).orElseThrow();
        assertThat(refreshed.getOverdueReminderCount()).isEqualTo(2);

        // …ni par un declenchement direct du moteur (garde MAX_REMINDERS de l'executeur).
        automationEngine.fireTrigger(AutomationTrigger.INVOICE_OVERDUE, orgAId,
                new AutomationSubject(AutomationSubject.TYPE_INVOICE, invoice.getId(),
                        Map.of(AutomationSubject.DATA_DAYS_OVERDUE, 9L)));
        refreshed = invoiceRepository.findById(invoice.getId()).orElseThrow();
        assertThat(refreshed.getOverdueReminderCount()).isEqualTo(2);
        verify(emailService, times(2)).sendContactMessage(
                eq("paul.payeur@test.com"), anyString(), any(), any(), anyString(), anyString(), anyList());

        List<AutomationExecution> executions = reminderExecutions(orgAId);
        assertThat(executions.stream()
                .filter(e -> e.getStatus() == AutomationExecutionStatus.EXECUTED)).hasSize(2);
        assertThat(executions.stream()
                .filter(e -> e.getStatus() == AutomationExecutionStatus.FAILED)).isEmpty();

        // ── Zero-fuite : la facture org B (sans regle org B) n'a jamais ete relancee. ──
        Invoice refreshedB = invoiceRepository.findById(invoiceB.getId()).orElseThrow();
        assertThat(refreshedB.getOverdueReminderCount()).isZero();
        assertThat(reminderExecutions(orgBId)).isEmpty();
    }

    @Test
    void paidInvoice_isNeverReminded() {
        Invoice paid = seedInvoice(orgAId, InvoiceStatus.PAID, LocalDate.now().minusDays(10),
                reservation.getId());
        paid.setOverdueNotifiedAt(LocalDateTime.now().minusDays(7));
        invoiceRepository.save(paid);

        automationEngine.fireTrigger(AutomationTrigger.INVOICE_OVERDUE, orgAId,
                new AutomationSubject(AutomationSubject.TYPE_INVOICE, paid.getId(),
                        Map.of(AutomationSubject.DATA_DAYS_OVERDUE, 7L)));

        Invoice refreshed = invoiceRepository.findById(paid.getId()).orElseThrow();
        assertThat(refreshed.getOverdueReminderCount()).isZero();
        List<AutomationExecution> executions = reminderExecutions(orgAId);
        assertThat(executions).hasSize(1);
        assertThat(executions.get(0).getStatus()).isEqualTo(AutomationExecutionStatus.SKIPPED);
    }
}
