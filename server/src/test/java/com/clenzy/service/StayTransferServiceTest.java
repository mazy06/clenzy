package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.StayTransfer;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.StayTransferRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StayTransferServiceTest {

    private static final Long ORG_ID = 7L;
    private static final Long RESERVATION_ID = 100L;

    @Mock private StayTransferRepository stayTransferRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private ReservationService reservationServiceMock;
    @Mock private EmailService emailService;
    @Mock private TenantScopedExecutor tenantScopedExecutor;
    @Mock private com.clenzy.service.agent.supervision.SupervisionActivityService activityService;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-02T10:00:00Z"), ZoneId.of("UTC"));

    private StayTransferService service;

    private static <T> ObjectProvider<T> provider(T bean) {
        return new ObjectProvider<>() {
            @Override public T getObject() { return bean; }
        };
    }

    @BeforeEach
    void setUp() {
        service = new StayTransferService(stayTransferRepository, reservationRepository,
                propertyRepository, calendarDayRepository, provider(reservationServiceMock),
                emailService, tenantScopedExecutor, activityService, clock);
        ReflectionTestUtils.setField(service, "appBaseUrl", "https://app.example.com");
        // Le TenantScopedExecutor de test exécute l'action inline.
        doAnswer(inv -> { ((Runnable) inv.getArgument(1)).run(); return null; })
                .when(tenantScopedExecutor).runAsOrganization(any(), any(Runnable.class));
    }

    private Reservation activeReservation() {
        Property from = new Property();
        from.setId(1L);
        Guest guest = new Guest();
        guest.setEmail("amina@example.com");
        Reservation reservation = new Reservation();
        reservation.setId(RESERVATION_ID);
        reservation.setOrganizationId(ORG_ID);
        reservation.setStatus("confirmed");
        reservation.setProperty(from);
        reservation.setGuestName("Amina Benali");
        reservation.setCheckIn(LocalDate.parse("2026-06-30"));
        reservation.setCheckOut(LocalDate.parse("2026-07-08")); // clock = 02/07
        reservation.setGuest(guest);
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation));
        return reservation;
    }

    private Property target() {
        Property target = new Property();
        target.setId(2L);
        target.setName("Villa Palmeraie");
        target.setOrganizationId(ORG_ID);
        when(propertyRepository.findById(2L)).thenReturn(Optional.of(target));
        return target;
    }

    @Test
    @DisplayName("whenProposing_thenTransferSavedAndOfferEmailedWithConfirmLink")
    void whenProposing_thenTransferSavedAndOfferEmailedWithConfirmLink() {
        activeReservation();
        target();
        when(calendarDayRepository.findByPropertyAndDateRange(eq(2L), any(), any(), eq(ORG_ID)))
                .thenReturn(List.of());
        when(stayTransferRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StayTransfer transfer = service.propose(ORG_ID, RESERVATION_ID, 2L, "incident", "user:kc-9");

        assertThat(transfer.getStatus()).isEqualTo(StayTransfer.Status.PROPOSED);
        assertThat(transfer.getConfirmToken()).isNotNull();
        verify(emailService).sendSimpleHtmlEmail(eq("amina@example.com"), anyString(),
                contains("/transfer/" + transfer.getConfirmToken()));
        verifyNoInteractions(reservationServiceMock); // rien de deplace a la proposition
    }

    @Test
    @DisplayName("whenTargetBecameBusy_thenProposalRefusedAndNoEmail")
    void whenTargetBecameBusy_thenProposalRefusedAndNoEmail() {
        activeReservation();
        target();
        when(calendarDayRepository.findByPropertyAndDateRange(eq(2L), any(), any(), eq(ORG_ID)))
                .thenReturn(List.of(new com.clenzy.model.CalendarDay()));

        assertThatThrownBy(() -> service.propose(ORG_ID, RESERVATION_ID, 2L, null, "user:kc-9"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("plus libre");
        verifyNoInteractions(emailService);
    }

    @Test
    @DisplayName("whenProposalAlreadyPending_thenNoSecondLink")
    void whenProposalAlreadyPending_thenNoSecondLink() {
        activeReservation();
        target();
        when(stayTransferRepository.existsByOrganizationIdAndReservationIdAndStatus(
                ORG_ID, RESERVATION_ID, StayTransfer.Status.PROPOSED)).thenReturn(true);

        assertThatThrownBy(() -> service.propose(ORG_ID, RESERVATION_ID, 2L, null, "user:kc-9"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("déjà en attente");
        verifyNoInteractions(emailService);
    }

    private StayTransfer proposedTransfer(UUID token) {
        StayTransfer transfer = new StayTransfer();
        ReflectionTestUtils.setField(transfer, "id", 55L);
        transfer.setOrganizationId(ORG_ID);
        transfer.setReservationId(RESERVATION_ID);
        transfer.setFromPropertyId(1L);
        transfer.setToPropertyId(2L);
        transfer.setConfirmToken(token);
        transfer.setExpiresAt(Instant.parse("2026-07-04T10:00:00Z"));
        when(stayTransferRepository.findByConfirmToken(token)).thenReturn(Optional.of(transfer));
        return transfer;
    }

    @Test
    @DisplayName("whenGuestConfirms_thenCanonicalRelodgeRunsAndTransferDone")
    void whenGuestConfirms_thenCanonicalRelodgeRunsAndTransferDone() {
        UUID token = UUID.randomUUID();
        proposedTransfer(token);
        activeReservation();
        target();
        when(propertyRepository.findById(1L)).thenReturn(Optional.of(new Property()));
        when(stayTransferRepository.markConfirmed(eq(55L), any())).thenReturn(1);

        service.confirm(token);

        verify(reservationServiceMock).relodge(RESERVATION_ID, 2L, "guest:stay-transfer:55");
        verify(stayTransferRepository).markDone(eq(55L), any());
    }

    @Test
    @DisplayName("whenRelodgeFailsAtConfirm_thenTransferCancelledAndHostNotified")
    void whenRelodgeFailsAtConfirm_thenTransferCancelledAndHostNotified() {
        UUID token = UUID.randomUUID();
        proposedTransfer(token);
        when(stayTransferRepository.markConfirmed(eq(55L), any())).thenReturn(1);
        when(reservationServiceMock.relodge(any(), any(), anyString()))
                .thenThrow(new IllegalStateException("conflit calendrier"));

        assertThatThrownBy(() -> service.confirm(token))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("prévenu");
        verify(stayTransferRepository).markCancelled(eq(55L), any());
        verify(stayTransferRepository, never()).markDone(any(), any());
    }

    @Test
    @DisplayName("whenLinkExpired_thenConfirmRefused")
    void whenLinkExpired_thenConfirmRefused() {
        UUID token = UUID.randomUUID();
        StayTransfer transfer = proposedTransfer(token);
        transfer.setExpiresAt(Instant.parse("2026-07-01T10:00:00Z")); // clock = 02/07

        assertThatThrownBy(() -> service.confirm(token))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("expiré");
        verifyNoInteractions(reservationServiceMock);
    }

    @Test
    @DisplayName("whenGuestDeclines_thenCancelledAndFeedInformed")
    void whenGuestDeclines_thenCancelledAndFeedInformed() {
        UUID token = UUID.randomUUID();
        proposedTransfer(token);

        service.decline(token);

        verify(stayTransferRepository).markCancelled(eq(55L), any());
        verify(activityService).recordModuleActNewTx(eq(ORG_ID), eq(1L), eq("gst"),
                eq("stay_transfer"), contains("refusé"));
        verifyNoInteractions(reservationServiceMock);
    }
}
