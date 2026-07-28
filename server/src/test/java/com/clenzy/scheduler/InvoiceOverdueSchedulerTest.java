package com.clenzy.scheduler;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.service.InvoiceOverduePersistence;
import com.clenzy.service.InvoiceOverduePersistence.OverdueInvoice;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.InvoiceReminderExecutor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Scheduler factures en retard (fiche 08, F5a) : marquage OVERDUE + trigger
 * INVOICE_OVERDUE, passe de relance quotidienne avec daysOverdue.
 *
 * <p>Les accès base vivent dans {@link InvoiceOverduePersistence} (transactions courtes
 * instrumentables par l'aspect RLS) et sont testés dans
 * {@code InvoiceOverduePersistenceTest} — ici, la persistance est mockée.</p>
 */
@ExtendWith(MockitoExtension.class)
class InvoiceOverdueSchedulerTest {

    @Mock private InvoiceOverduePersistence overdueInvoices;
    @Mock private AutomationEngine automationEngine;

    @InjectMocks
    private InvoiceOverdueScheduler scheduler;

    private static final LocalDate DUE_DATE = LocalDate.now().minusDays(1);

    private OverdueInvoice overdue(Long id, Long orgId, long daysOverdue) {
        return new OverdueInvoice(id, orgId, "FAC-2026-00" + id, DUE_DATE, daysOverdue);
    }

    @Test
    void whenInvoicePastDue_thenMarksOverdueAndFiresTrigger() {
        when(overdueInvoices.findOverdueCandidateIds(anyList(), any(LocalDate.class)))
            .thenReturn(List.of(200L));
        when(overdueInvoices.markOverdue(200L)).thenReturn(overdue(200L, 1L, 0L));

        scheduler.checkOverdueInvoices();

        verify(overdueInvoices).markOverdue(200L);

        ArgumentCaptor<AutomationSubject> captor = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(automationEngine).fireTrigger(eq(AutomationTrigger.INVOICE_OVERDUE), eq(1L), captor.capture());
        AutomationSubject subject = captor.getValue();
        assertThat(subject.subjectType()).isEqualTo(AutomationSubject.TYPE_INVOICE);
        assertThat(subject.subjectId()).isEqualTo(200L);
        assertThat(subject.data()).containsKey(AutomationSubject.DATA_DAYS_OVERDUE);
    }

    @Test
    void whenNoCandidates_thenNothingFired() {
        when(overdueInvoices.findOverdueCandidateIds(anyList(), any(LocalDate.class)))
            .thenReturn(List.of());

        scheduler.checkOverdueInvoices();

        verifyNoInteractions(automationEngine);
    }

    @Test
    void markingPass_whenOneInvoiceFails_thenOthersStillMarked() {
        when(overdueInvoices.findOverdueCandidateIds(anyList(), any(LocalDate.class)))
            .thenReturn(List.of(300L, 200L));
        when(overdueInvoices.markOverdue(300L))
            .thenThrow(new IllegalStateException("Facture introuvable : 300"));
        when(overdueInvoices.markOverdue(200L)).thenReturn(overdue(200L, 1L, 0L));

        scheduler.checkOverdueInvoices();

        verify(automationEngine).fireTrigger(eq(AutomationTrigger.INVOICE_OVERDUE), eq(1L), any());
    }

    @Test
    void reminderPass_firesTriggerWithDaysOverdue_forInvoicesWithBudgetLeft() {
        when(overdueInvoices.findRemindable(InvoiceReminderExecutor.MAX_REMINDERS))
            .thenReturn(List.of(overdue(200L, 1L, 4L)));

        scheduler.fireOverdueReminders();

        ArgumentCaptor<AutomationSubject> captor = ArgumentCaptor.forClass(AutomationSubject.class);
        verify(automationEngine).fireTrigger(eq(AutomationTrigger.INVOICE_OVERDUE), eq(1L), captor.capture());
        assertThat(captor.getValue().data().get(AutomationSubject.DATA_DAYS_OVERDUE)).isEqualTo(4L);
    }

    @Test
    void reminderPass_whenOneInvoiceFails_thenOthersStillFired() {
        when(overdueInvoices.findRemindable(anyInt()))
            .thenReturn(List.of(overdue(300L, 2L, 3L), overdue(200L, 1L, 3L)));
        doThrow(new RuntimeException("moteur KO"))
            .when(automationEngine).fireTrigger(any(), eq(2L), any());

        scheduler.fireOverdueReminders();

        // La facture de l'org 1 est quand meme presentee au moteur.
        verify(automationEngine).fireTrigger(eq(AutomationTrigger.INVOICE_OVERDUE), eq(1L), any());
    }

    @Test
    void reminderPass_whenNothingRemindable_thenEngineUntouched() {
        when(overdueInvoices.findRemindable(anyInt())).thenReturn(List.of());

        scheduler.fireOverdueReminders();

        verifyNoInteractions(automationEngine);
    }

    @Test
    void markingPass_scansOnlySentAndIssuedInvoices() {
        when(overdueInvoices.findOverdueCandidateIds(anyList(), any(LocalDate.class)))
            .thenReturn(List.of());

        scheduler.checkOverdueInvoices();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<InvoiceStatus>> captor = ArgumentCaptor.forClass(List.class);
        verify(overdueInvoices).findOverdueCandidateIds(captor.capture(), any(LocalDate.class));
        assertThat(captor.getValue())
            .containsExactlyInAnyOrder(InvoiceStatus.SENT, InvoiceStatus.ISSUED);
    }
}
