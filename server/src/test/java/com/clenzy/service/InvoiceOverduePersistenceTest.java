package com.clenzy.service;

import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.repository.InvoiceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de InvoiceOverduePersistence : balayage cross-tenant, marquage OVERDUE et calcul
 * du retard.
 *
 * <p>Ce bean existe pour que le balayage passe par le proxy Spring — c'est lui qui
 * déclenche l'aspect posant les GUC de Row-Level Security (audit RLS, plan REM-T-01).
 * Sans transaction instrumentable, la RLS active renverrait zéro facture sans erreur.</p>
 */
@ExtendWith(MockitoExtension.class)
class InvoiceOverduePersistenceTest {

    @Mock private InvoiceRepository invoiceRepository;

    @InjectMocks private InvoiceOverduePersistence persistence;

    private Invoice invoice(Long id, Long orgId) {
        Invoice invoice = new Invoice();
        invoice.setId(id);
        invoice.setOrganizationId(orgId);
        invoice.setInvoiceNumber("FAC-2026-0042");
        invoice.setStatus(InvoiceStatus.SENT);
        invoice.setDueDate(LocalDate.now().minusDays(5));
        return invoice;
    }

    @Nested
    @DisplayName("findOverdueCandidateIds")
    class FindCandidates {

        @Test
        void returnsIdsOnly() {
            when(invoiceRepository.findOverdueCandidates(anyList(), any(LocalDate.class)))
                .thenReturn(List.of(invoice(200L, 1L), invoice(300L, 2L)));

            List<Long> ids = persistence.findOverdueCandidateIds(
                List.of(InvoiceStatus.SENT), LocalDate.now());

            assertThat(ids).containsExactly(200L, 300L);
        }
    }

    @Nested
    @DisplayName("markOverdue")
    class MarkOverdue {

        @Test
        void setsStatusAndStampsNotificationDate() {
            Invoice invoice = invoice(200L, 1L);
            when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));
            when(invoiceRepository.save(invoice)).thenReturn(invoice);

            InvoiceOverduePersistence.OverdueInvoice marked = persistence.markOverdue(200L);

            assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.OVERDUE);
            assertThat(invoice.getOverdueNotifiedAt()).isNotNull();
            assertThat(marked.id()).isEqualTo(200L);
            assertThat(marked.organizationId()).isEqualTo(1L);
            assertThat(marked.invoiceNumber()).isEqualTo("FAC-2026-0042");
            // Marquée à l'instant : aucun retard compté depuis le passage OVERDUE.
            assertThat(marked.daysOverdue()).isZero();
        }

        @Test
        void whenInvoiceVanished_thenThrowsInsteadOfSilentSkip() {
            when(invoiceRepository.findById(200L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> persistence.markOverdue(200L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("200");
            verify(invoiceRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("findRemindable")
    class FindRemindable {

        @Test
        void countsDaysSinceOverdueStamp() {
            Invoice invoice = invoice(200L, 1L);
            invoice.setStatus(InvoiceStatus.OVERDUE);
            invoice.setOverdueNotifiedAt(LocalDateTime.now().minusDays(4));
            when(invoiceRepository.findByStatusAndOverdueReminderCountLessThan(
                    any(InvoiceStatus.class), anyInt()))
                .thenReturn(List.of(invoice));

            List<InvoiceOverduePersistence.OverdueInvoice> remindable = persistence.findRemindable(2);

            assertThat(remindable).singleElement()
                .satisfies(o -> assertThat(o.daysOverdue()).isEqualTo(4L));
        }

        @Test
        void whenNeverStamped_thenFallsBackToDueDate() {
            Invoice invoice = invoice(200L, 1L);
            invoice.setStatus(InvoiceStatus.OVERDUE);
            invoice.setOverdueNotifiedAt(null);
            when(invoiceRepository.findByStatusAndOverdueReminderCountLessThan(
                    any(InvoiceStatus.class), anyInt()))
                .thenReturn(List.of(invoice));

            List<InvoiceOverduePersistence.OverdueInvoice> remindable = persistence.findRemindable(2);

            assertThat(remindable).singleElement()
                .satisfies(o -> assertThat(o.daysOverdue()).isEqualTo(5L));
        }

        @Test
        void whenDueDateInFuture_thenDaysOverdueNeverNegative() {
            Invoice invoice = invoice(200L, 1L);
            invoice.setStatus(InvoiceStatus.OVERDUE);
            invoice.setOverdueNotifiedAt(null);
            invoice.setDueDate(LocalDate.now().plusDays(3));
            when(invoiceRepository.findByStatusAndOverdueReminderCountLessThan(
                    any(InvoiceStatus.class), anyInt()))
                .thenReturn(List.of(invoice));

            List<InvoiceOverduePersistence.OverdueInvoice> remindable = persistence.findRemindable(2);

            assertThat(remindable).singleElement()
                .satisfies(o -> assertThat(o.daysOverdue()).isZero());
        }
    }
}
