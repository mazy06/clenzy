package com.clenzy.scheduler;

import com.clenzy.model.AbandonedBooking;
import com.clenzy.model.AbandonedBookingStatus;
import com.clenzy.repository.AbandonedBookingRepository;
import com.clenzy.repository.MarketingContactRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.AbandonedBookingService;
import com.clenzy.service.EmailService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Relance de panier abandonné : flag global default-off, éligibilité (PENDING + consentement + délai),
 * gate RGPD (consentement / opt-out), org désactivée, borne et idempotence par étape.
 */
@ExtendWith(MockitoExtension.class)
class AbandonedBookingRecoverySchedulerTest {

    private static final Long ORG = 1L;
    private static final String EMAIL = "alice@example.com";
    private static final Instant NOW = Instant.parse("2026-06-14T12:00:00Z");

    @Mock private AbandonedBookingRepository repository;
    @Mock private AbandonedBookingService abandonedBookingService;
    @Mock private EmailService emailService;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private MarketingContactRepository marketingContactRepository;
    @Mock private SupervisionActivityService supervisionActivityService;

    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private AbandonedBookingRecoveryScheduler enabledScheduler() {
        return new AbandonedBookingRecoveryScheduler(repository, abandonedBookingService, emailService,
            organizationRepository, marketingContactRepository, supervisionActivityService, clock, true,
            "https://app.clenzy.fr");
    }

    private AbandonedBooking pending(String email, int reminderCount, Duration age) {
        AbandonedBooking ab = new AbandonedBooking();
        ab.setId(99L);
        ab.setOrganizationId(ORG);
        ab.setReservationId(7L);
        ab.setGuestEmail(email);
        ab.setGuestName("Alice Martin");
        ab.setPropertyId(42L);
        ab.setPropertyName("Villa Azur");
        ab.setCheckIn(LocalDate.of(2026, 7, 1));
        ab.setCheckOut(LocalDate.of(2026, 7, 5));
        ab.setGuests(2);
        ab.setStatus(AbandonedBookingStatus.PENDING);
        ab.setReminderCount(reminderCount);
        ab.setCreatedAt(NOW.minus(age));
        return ab;
    }

    private void consented() {
        lenient().when(marketingContactRepository.findConsentedSubscribedEmails(eq(ORG), any(Collection.class)))
            .thenReturn(List.of(EMAIL));
    }

    private void noOrgDisabled() {
        lenient().when(organizationRepository.findIdsWithAbandonedCartRecoveryDisabled()).thenReturn(Set.of());
    }

    @Test
    void disabledFlag_noOp() {
        AbandonedBookingRecoveryScheduler disabled = new AbandonedBookingRecoveryScheduler(
            repository, abandonedBookingService, emailService, organizationRepository,
            marketingContactRepository, supervisionActivityService, clock, false, "https://app.clenzy.fr");

        disabled.sendRecoveryEmails();

        verifyNoInteractions(repository, emailService, abandonedBookingService,
            organizationRepository, marketingContactRepository);
    }

    @Test
    void eligible_pendingConsentedDue_sendsEmailAndRecords() {
        noOrgDisabled();
        consented();
        AbandonedBooking ab = pending(EMAIL, 0, Duration.ofHours(2)); // > 1h (étape 0)
        when(repository.findDueForRecovery(any(), any())).thenReturn(List.of(ab));

        enabledScheduler().sendRecoveryEmails();

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendSimpleHtmlEmail(eq(EMAIL), anyString(), body.capture());
        verify(abandonedBookingService).recordReminderSent(ab, false);
        // Deep-link de reprise pré-rempli (propertyId + dates + guests).
        assertThat(body.getValue())
            .contains("/book?")
            .contains("propertyId=42")
            .contains("checkIn=2026-07-01")
            .contains("source=cart-recovery");
    }

    @Test
    void notDueYet_skipped() {
        noOrgDisabled();
        AbandonedBooking ab = pending(EMAIL, 0, Duration.ofMinutes(30)); // < 1h
        when(repository.findDueForRecovery(any(), any())).thenReturn(List.of(ab));

        enabledScheduler().sendRecoveryEmails();

        verify(emailService, never()).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
        verify(abandonedBookingService, never()).recordReminderSent(any(), anyBoolean());
    }

    @Test
    void noConsent_skipped() {
        noOrgDisabled();
        when(marketingContactRepository.findConsentedSubscribedEmails(eq(ORG), any(Collection.class)))
            .thenReturn(List.of()); // ni consentement ni abonnement
        AbandonedBooking ab = pending(EMAIL, 0, Duration.ofHours(2));
        when(repository.findDueForRecovery(any(), any())).thenReturn(List.of(ab));

        enabledScheduler().sendRecoveryEmails();

        verify(emailService, never()).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
        verify(abandonedBookingService, never()).recordReminderSent(any(), anyBoolean());
    }

    @Test
    void optedOut_skipped() {
        noOrgDisabled();
        // opt-out (UNSUBSCRIBED) → l'email ne figure pas dans les consentis/abonnés.
        when(marketingContactRepository.findConsentedSubscribedEmails(eq(ORG), any(Collection.class)))
            .thenReturn(List.of());
        AbandonedBooking ab = pending(EMAIL, 1, Duration.ofHours(25));
        when(repository.findDueForRecovery(any(), any())).thenReturn(List.of(ab));

        enabledScheduler().sendRecoveryEmails();

        verify(emailService, never()).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
    }

    @Test
    void orgDisabled_skipped() {
        when(organizationRepository.findIdsWithAbandonedCartRecoveryDisabled()).thenReturn(Set.of(ORG));
        AbandonedBooking ab = pending(EMAIL, 0, Duration.ofHours(2));
        when(repository.findDueForRecovery(any(), any())).thenReturn(List.of(ab));

        enabledScheduler().sendRecoveryEmails();

        verify(emailService, never()).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
        verify(marketingContactRepository, never()).findConsentedSubscribedEmails(any(), any());
    }

    @Test
    void maxRemindersReached_skipped() {
        noOrgDisabled();
        // reminderCount = 3 = hors plage (borne : 3 étapes max 0/1/2) → plus de relance.
        AbandonedBooking ab = pending(EMAIL, 3, Duration.ofHours(200));
        when(repository.findDueForRecovery(any(), any())).thenReturn(List.of(ab));

        enabledScheduler().sendRecoveryEmails();

        verify(emailService, never()).sendSimpleHtmlEmail(anyString(), anyString(), anyString());
    }

    @Test
    void finalStep_marksRecoverySentTerminal() {
        noOrgDisabled();
        consented();
        AbandonedBooking ab = pending(EMAIL, 2, Duration.ofHours(80)); // > 72h (étape 2 = finale)
        when(repository.findDueForRecovery(any(), any())).thenReturn(List.of(ab));

        enabledScheduler().sendRecoveryEmails();

        verify(emailService).sendSimpleHtmlEmail(eq(EMAIL), anyString(), anyString());
        verify(abandonedBookingService).recordReminderSent(ab, true); // finalStep = true
    }
}
