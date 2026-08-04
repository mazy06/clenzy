package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.StayModification;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.StayModificationRepository;
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

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
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
class StayModificationServiceTest {

    private static final Long ORG_ID = 7L;
    private static final Long RESERVATION_ID = 100L;
    private static final Long PROPERTY_ID = 42L;

    @Mock private StayModificationRepository stayModificationRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private PriceEngine priceEngine;
    @Mock private ReservationService reservationServiceMock;
    @Mock private ReservationRefundService refundServiceMock;
    @Mock private EmailService emailService;
    @Mock private TenantScopedExecutor tenantScopedExecutor;
    @Mock private com.clenzy.service.agent.supervision.SupervisionActivityService activityService;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-02T10:00:00Z"), ZoneId.of("UTC"));

    private StayModificationService service;

    private static <T> ObjectProvider<T> provider(T bean) {
        return new ObjectProvider<>() {
            @Override public T getObject() { return bean; }
        };
    }

    @BeforeEach
    void setUp() {
        service = new StayModificationService(stayModificationRepository, reservationRepository,
                calendarDayRepository, priceEngine, provider(reservationServiceMock),
                provider(refundServiceMock), emailService, tenantScopedExecutor,
                activityService, clock);
        ReflectionTestUtils.setField(service, "appBaseUrl", "https://app.example.com");
        doAnswer(inv -> { ((Runnable) inv.getArgument(1)).run(); return null; })
                .when(tenantScopedExecutor).runAsOrganization(any(), any(Runnable.class));
        when(calendarDayRepository.findByPropertyAndDateRange(any(), any(), any(), any()))
                .thenReturn(List.of());
    }

    private Reservation activeReservation(String total) {
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setName("Riad Yasmine");
        Guest guest = new Guest();
        guest.setEmail("amina@example.com");
        Reservation reservation = new Reservation();
        reservation.setId(RESERVATION_ID);
        reservation.setOrganizationId(ORG_ID);
        reservation.setStatus("confirmed");
        reservation.setProperty(property);
        reservation.setGuest(guest);
        reservation.setGuestName("Amina Benali");
        reservation.setCheckIn(LocalDate.parse("2026-07-04"));
        reservation.setCheckOut(LocalDate.parse("2026-07-07"));
        reservation.setTotalPrice(new BigDecimal(total));
        when(reservationRepository.findById(RESERVATION_ID)).thenReturn(Optional.of(reservation));
        return reservation;
    }

    private void priceRange(String nightly, LocalDate from, LocalDate toInclusive) {
        Map<LocalDate, BigDecimal> prices = new java.util.HashMap<>();
        for (LocalDate d = from; !d.isAfter(toInclusive); d = d.plusDays(1)) {
            prices.put(d, new BigDecimal(nightly));
        }
        when(priceEngine.resolvePriceRange(PROPERTY_ID, from, toInclusive, ORG_ID))
                .thenReturn(prices);
    }

    @Test
    @DisplayName("whenProposing_thenQuoteComputedAndOfferEmailedWithLink")
    void whenProposing_thenQuoteComputedAndOfferEmailedWithLink() {
        activeReservation("300");
        priceRange("120", LocalDate.parse("2026-07-06"), LocalDate.parse("2026-07-08"));
        when(stayModificationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StayModification modification = service.propose(ORG_ID, RESERVATION_ID,
                LocalDate.parse("2026-07-06"), LocalDate.parse("2026-07-09"), "user:kc-9");

        assertThat(modification.getNewTotal()).isEqualByComparingTo("360");
        assertThat(modification.getPriceDelta()).isEqualByComparingTo("60");
        verify(emailService).sendSimpleHtmlEmail(eq("amina@example.com"), anyString(),
                contains("/stay-change/" + modification.getConfirmToken()));
        verifyNoInteractions(reservationServiceMock); // rien d'applique a la proposition
    }

    private StayModification proposedModification(UUID token, String oldTotal, String newTotal) {
        StayModification modification = new StayModification();
        ReflectionTestUtils.setField(modification, "id", 66L);
        modification.setOrganizationId(ORG_ID);
        modification.setReservationId(RESERVATION_ID);
        modification.setNewCheckIn(LocalDate.parse("2026-07-06"));
        modification.setNewCheckOut(LocalDate.parse("2026-07-09"));
        modification.setOldTotal(new BigDecimal(oldTotal));
        modification.setNewTotal(new BigDecimal(newTotal));
        modification.setConfirmToken(token);
        modification.setExpiresAt(Instant.parse("2026-07-04T10:00:00Z"));
        when(stayModificationRepository.findByConfirmToken(token))
                .thenReturn(Optional.of(modification));
        return modification;
    }

    @Test
    @DisplayName("whenGuestConfirms_thenRescheduleRunsWithServerTotalAndSupplementTracked")
    void whenGuestConfirms_thenRescheduleRunsWithServerTotalAndSupplementTracked() {
        UUID token = UUID.randomUUID();
        proposedModification(token, "300", "360");
        activeReservation("300");
        priceRange("120", LocalDate.parse("2026-07-06"), LocalDate.parse("2026-07-08"));
        when(stayModificationRepository.markConfirmed(eq(66L), any())).thenReturn(1);

        service.confirm(token);

        verify(reservationServiceMock).reschedule(eq(RESERVATION_ID),
                eq(LocalDate.parse("2026-07-06")), eq(LocalDate.parse("2026-07-09")),
                eq(new BigDecimal("360")), eq("guest:stay-modification:66"));
        verify(stayModificationRepository).markDone(eq(66L), any(),
                eq(new BigDecimal("360")), eq(new BigDecimal("60")));
        // Complement (+60) : jamais encaisse automatiquement — le feed previent l'hote.
        verifyNoInteractions(refundServiceMock);
        verify(activityService).recordModuleActNewTx(eq(ORG_ID), eq(PROPERTY_ID), eq("gst"),
                eq("stay_modification"), contains("complément"));
    }

    @Test
    @DisplayName("whenGuestConfirmsCheaperStay_thenOverpaidAutoRefunded")
    void whenGuestConfirmsCheaperStay_thenOverpaidAutoRefunded() {
        UUID token = UUID.randomUUID();
        proposedModification(token, "300", "240");
        activeReservation("300");
        priceRange("80", LocalDate.parse("2026-07-06"), LocalDate.parse("2026-07-08"));
        when(stayModificationRepository.markConfirmed(eq(66L), any())).thenReturn(1);

        service.confirm(token);

        verify(refundServiceMock).initiateRefund(RESERVATION_ID, 6000L,
                ReservationRefundService.REASON_GESTURE, ORG_ID);
        verify(activityService).recordModuleActNewTx(eq(ORG_ID), eq(PROPERTY_ID), eq("gst"),
                eq("stay_modification"), contains("remboursé"));
    }

    @Test
    @DisplayName("whenPriceRoseSinceQuote_thenConfirmCancelledNeverAppliedHigher")
    void whenPriceRoseSinceQuote_thenConfirmCancelledNeverAppliedHigher() {
        UUID token = UUID.randomUUID();
        proposedModification(token, "300", "360");
        activeReservation("300");
        priceRange("150", LocalDate.parse("2026-07-06"), LocalDate.parse("2026-07-08")); // 450 > 360
        when(stayModificationRepository.markConfirmed(eq(66L), any())).thenReturn(1);

        assertThatThrownBy(() -> service.confirm(token))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("prévenu");
        verify(reservationServiceMock, never()).reschedule(any(), any(), any(), any(), anyString());
        verify(stayModificationRepository).markCancelled(eq(66L), any());
    }

    @Test
    @DisplayName("whenLinkExpired_thenConfirmRefused")
    void whenLinkExpired_thenConfirmRefused() {
        UUID token = UUID.randomUUID();
        StayModification modification = proposedModification(token, "300", "360");
        modification.setExpiresAt(Instant.parse("2026-07-01T10:00:00Z")); // clock = 02/07

        assertThatThrownBy(() -> service.confirm(token))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("expiré");
        verifyNoInteractions(reservationServiceMock);
    }

    @Test
    @DisplayName("whenGuestDeclines_thenCancelledAndHostInformed")
    void whenGuestDeclines_thenCancelledAndHostInformed() {
        UUID token = UUID.randomUUID();
        proposedModification(token, "300", "360");
        activeReservation("300");

        service.decline(token);

        verify(stayModificationRepository).markCancelled(eq(66L), any());
        verify(activityService).recordModuleActNewTx(eq(ORG_ID), eq(PROPERTY_ID), eq("gst"),
                eq("stay_modification"), contains("refusé"));
        verifyNoInteractions(reservationServiceMock);
    }
}
