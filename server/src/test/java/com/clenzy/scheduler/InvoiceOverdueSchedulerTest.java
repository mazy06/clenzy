package com.clenzy.scheduler;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.InvoiceReminderExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Scheduler factures en retard (fiche 08, F5a) : marquage OVERDUE + trigger
 * INVOICE_OVERDUE, passe de relance quotidienne avec daysOverdue.
 */
@ExtendWith(MockitoExtension.class)
class InvoiceOverdueSchedulerTest {

    @Mock private InvoiceRepository invoiceRepository;
    @Mock private AutomationEngine automationEngine;

    @InjectMocks
    private InvoiceOverdueScheduler scheduler;

    private Invoice invoice;

    @BeforeEach
    void setUp() {
        invoice = new Invoice();
        invoice.setId(200L);
        invoice.setOrganizationId(1L);
        invoice.setInvoiceNumber("FAC-2026-0042");
        invoice.setStatus(InvoiceStatus.SENT);
        invoice.setDueDate(LocalDate.now().minusDays(1));
    }

    @Test
    void whenInvoicePastDue_thenMarksOverdueAndFiresTrigger() {
        when(invoiceRepository.findOverdueCandidates(anyList(), any(LocalDate.class)))
            .thenReturn(List.of(invoice));

        scheduler.checkOverdueInvoices();

        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.OVERDUE);
        assertThat(invoice.getOverdueNotifiedAt()).isNotNull();
        verify(invoiceRepository).save(invoice);

        ArgumentCaptor<AutomationSubject> captor = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(automationEngine).fireTrigger(eq(AutomationTrigger.INVOICE_OVERDUE), eq(1L), captor.capture());
        AutomationSubject subject = captor.getValue();
        assertThat(subject.subjectType()).isEqualTo(AutomationSubject.TYPE_INVOICE);
        assertThat(subject.subjectId()).isEqualTo(200L);
        assertThat(subject.data()).containsKey(AutomationSubject.DATA_DAYS_OVERDUE);
    }

    @Test
    void whenNoCandidates_thenNothingFired() {
        when(invoiceRepository.findOverdueCandidates(anyList(), any(LocalDate.class)))
            .thenReturn(List.of());

        scheduler.checkOverdueInvoices();

        verifyNoInteractions(automationEngine);
    }

    @Test
    void reminderPass_firesTriggerWithDaysOverdue_forInvoicesWithBudgetLeft() {
        invoice.setStatus(InvoiceStatus.OVERDUE);
        invoice.setOverdueNotifiedAt(LocalDateTime.now().minusDays(4));
        when(invoiceRepository.findByStatusAndOverdueReminderCountLessThan(
                InvoiceStatus.OVERDUE, InvoiceReminderExecutor.MAX_REMINDERS))
            .thenReturn(List.of(invoice));

        scheduler.fireOverdueReminders();

        ArgumentCaptor<AutomationSubject> captor = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(automationEngine).fireTrigger(eq(AutomationTrigger.INVOICE_OVERDUE), eq(1L), captor.capture());
        assertThat(captor.getValue().data().get(AutomationSubject.DATA_DAYS_OVERDUE)).isEqualTo(4L);
    }

    @Test
    void reminderPass_whenOneInvoiceFails_thenOthersStillFired() {
        Invoice failing = new Invoice();
        failing.setId(300L);
        failing.setOrganizationId(2L);
        failing.setStatus(InvoiceStatus.OVERDUE);
        failing.setOverdueNotifiedAt(LocalDateTime.now().minusDays(3));

        invoice.setStatus(InvoiceStatus.OVERDUE);
        invoice.setOverdueNotifiedAt(LocalDateTime.now().minusDays(3));

        when(invoiceRepository.findByStatusAndOverdueReminderCountLessThan(any(), anyInt()))
            .thenReturn(List.of(failing, invoice));
        doThrow(new RuntimeException("moteur KO"))
            .when(automationEngine).fireTrigger(any(), eq(2L), any());

        scheduler.fireOverdueReminders();

        // La facture de l'org 1 est quand meme presentee au moteur.
        verify(automationEngine).fireTrigger(eq(AutomationTrigger.INVOICE_OVERDUE), eq(1L), any());
    }
}
