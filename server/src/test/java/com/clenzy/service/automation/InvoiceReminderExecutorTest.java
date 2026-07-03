package com.clenzy.service.automation;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.Guest;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Executeur SEND_INVOICE_REMINDER (fiche 08, F5a) : cadence J+3/J+7, maximum
 * 2 relances par facture (idempotence en base), contenu email echappe.
 */
@ExtendWith(MockitoExtension.class)
class InvoiceReminderExecutorTest {

    @Mock private InvoiceRepository invoiceRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private EmailService emailService;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private InvoiceReminderExecutor executor;

    private static final Long ORG_ID = 1L;

    private AutomationRule rule;
    private Invoice invoice;

    @BeforeEach
    void setUp() {
        rule = new AutomationRule();
        rule.setId(9L);

        invoice = new Invoice();
        invoice.setId(200L);
        invoice.setOrganizationId(ORG_ID);
        invoice.setInvoiceNumber("FAC-2026-0042");
        invoice.setStatus(InvoiceStatus.OVERDUE);
        invoice.setDueDate(LocalDate.now().minusDays(10));
        invoice.setOverdueNotifiedAt(LocalDateTime.now().minusDays(4));
        invoice.setTotalTtc(new BigDecimal("150.00"));
        invoice.setReservationId(42L);
    }

    private AutomationActionContext invoiceCtx(Long invoiceId) {
        return new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_INVOICE, invoiceId,
            Map.of(AutomationSubject.DATA_DAYS_OVERDUE, 4L), null);
    }

    private void stubGuestRecipient(String email) {
        Guest guest = new Guest();
        guest.setFirstName("Marie");
        guest.setLastName("Martin");
        guest.setEmail(email);
        Reservation reservation = new Reservation();
        reservation.setId(42L);
        reservation.setOrganizationId(ORG_ID);
        reservation.setGuest(guest);
        when(reservationRepository.findById(42L)).thenReturn(Optional.of(reservation));
    }

    @Test
    void whenFirstReminderDue_thenSendsEmailAndIncrementsCounter() {
        when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));
        stubGuestRecipient("marie@guest.com");

        var result = executor.execute(rule, invoiceCtx(200L));

        assertThat(result.skipped()).isFalse();
        verify(emailService).sendContactMessage(
            eq("marie@guest.com"), eq("Marie Martin"), isNull(), isNull(),
            contains("FAC-2026-0042"), contains("150.00"), anyList());
        assertThat(invoice.getOverdueReminderCount()).isEqualTo(1);
        assertThat(invoice.getOverdueLastReminderAt()).isNotNull();
        verify(invoiceRepository).save(invoice);
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(ORG_ID), eq(NotificationKey.PAYMENT_DEFERRED_OVERDUE), anyString(), anyString(), anyString());
    }

    @Test
    void whenBuyerNameContainsHtml_thenEscapedInEmailBody() {
        when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));
        Guest guest = new Guest();
        guest.setFirstName("<script>alert(1)</script>");
        guest.setEmail("evil@guest.com");
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(ORG_ID);
        reservation.setGuest(guest);
        when(reservationRepository.findById(42L)).thenReturn(Optional.of(reservation));

        executor.execute(rule, invoiceCtx(200L));

        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendContactMessage(
            anyString(), any(), isNull(), isNull(), anyString(), bodyCaptor.capture(), anyList());
        assertThat(bodyCaptor.getValue()).doesNotContain("<script>");
    }

    @Test
    void whenMaxRemindersReached_thenSkipsWithoutSending() {
        invoice.setOverdueReminderCount(2);
        when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));

        var result = executor.execute(rule, invoiceCtx(200L));

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("maximum");
        verifyNoInteractions(emailService);
        verify(invoiceRepository, never()).save(any());
    }

    @Test
    void whenTooEarlyForFirstReminder_thenSkips() {
        invoice.setOverdueNotifiedAt(LocalDateTime.now().minusDays(1)); // J+1 < J+3
        when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));

        var result = executor.execute(rule, invoiceCtx(200L));

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("trop tot");
        verifyNoInteractions(emailService);
    }

    @Test
    void whenSecondReminderRequiresSevenDays_thenSkipsAtDayFive() {
        invoice.setOverdueReminderCount(1);
        invoice.setOverdueNotifiedAt(LocalDateTime.now().minusDays(5)); // J+5 < J+7
        invoice.setOverdueLastReminderAt(LocalDateTime.now().minusDays(2));
        when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));

        var result = executor.execute(rule, invoiceCtx(200L));

        assertThat(result.skipped()).isTrue();
        verifyNoInteractions(emailService);
    }

    @Test
    void whenSecondReminderDueAtDaySeven_thenSendsAndReachesMax() {
        invoice.setOverdueReminderCount(1);
        invoice.setOverdueNotifiedAt(LocalDateTime.now().minusDays(8));
        invoice.setOverdueLastReminderAt(LocalDateTime.now().minusDays(5));
        when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));
        stubGuestRecipient("marie@guest.com");

        var result = executor.execute(rule, invoiceCtx(200L));

        assertThat(result.skipped()).isFalse();
        assertThat(invoice.getOverdueReminderCount()).isEqualTo(2);
    }

    @Test
    void whenRemindedLessThan24hAgo_thenSkips() {
        invoice.setOverdueReminderCount(1);
        invoice.setOverdueNotifiedAt(LocalDateTime.now().minusDays(10));
        invoice.setOverdueLastReminderAt(LocalDateTime.now().minusHours(2));
        when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));

        var result = executor.execute(rule, invoiceCtx(200L));

        assertThat(result.skipped()).isTrue();
        verifyNoInteractions(emailService);
    }

    @Test
    void whenInvoiceNoLongerOverdue_thenSkips() {
        invoice.setStatus(InvoiceStatus.PAID);
        when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));

        var result = executor.execute(rule, invoiceCtx(200L));

        assertThat(result.skipped()).isTrue();
        verifyNoInteractions(emailService);
    }

    @Test
    void whenNoRecipientResolvable_thenConsumesReminderAndNotifiesStaffOnly() {
        invoice.setReservationId(null);
        invoice.setInterventionId(null);
        when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));

        var result = executor.execute(rule, invoiceCtx(200L));

        assertThat(result.skipped()).isFalse();
        verifyNoInteractions(emailService);
        // La relance est consommee (pas de re-notification quotidienne infinie).
        assertThat(invoice.getOverdueReminderCount()).isEqualTo(1);
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(ORG_ID), eq(NotificationKey.PAYMENT_DEFERRED_OVERDUE), anyString(),
            contains("Aucun email client"), anyString());
    }

    @Test
    void whenInvoiceBelongsToAnotherOrg_thenFailsExplicitly() {
        invoice.setOrganizationId(999L);
        when(invoiceRepository.findById(200L)).thenReturn(Optional.of(invoice));

        assertThatThrownBy(() -> executor.execute(rule, invoiceCtx(200L)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("hors de l'organisation");
    }

    @Test
    void whenWrongSubjectType_thenFailsExplicitly() {
        var ctx = new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_RESERVATION, 42L, Map.of(), null);

        assertThatThrownBy(() -> executor.execute(rule, ctx))
            .isInstanceOf(IllegalStateException.class);
    }
}
