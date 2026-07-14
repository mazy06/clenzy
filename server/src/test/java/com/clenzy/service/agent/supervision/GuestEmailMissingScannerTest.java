package com.clenzy.service.agent.supervision;

import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Scanner « email voyageur manquant » : emet une carte informationnelle Communication
 * quand un check-in approche (≤ 3 j) sans email, n'emet pas sinon, et auto-resout les
 * cartes PENDING dont la situation ne tient plus (email complete).
 */
@ExtendWith(MockitoExtension.class)
class GuestEmailMissingScannerTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 3L;
    private static final Long RES_ID = 77L;

    @Mock private ReservationRepository reservationRepository;
    @Mock private SupervisionSuggestionService suggestionService;

    // Aujourd'hui = 2026-07-08 (UTC ; propriete en Europe/Paris, meme jour a 10:00Z).
    private final Clock clock = Clock.fixed(Instant.parse("2026-07-08T10:00:00Z"), ZoneOffset.UTC);

    private GuestEmailMissingScanner scanner() {
        return new GuestEmailMissingScanner(reservationRepository, suggestionService, clock);
    }

    private Reservation reservation(String checkIn, String email) {
        Property property = new Property();
        property.setId(PROP);
        property.setTimezone("Europe/Paris");
        Reservation r = new Reservation();
        r.setId(RES_ID);
        r.setProperty(property);
        r.setGuestName("Jean Dupont");
        r.setCheckIn(LocalDate.parse(checkIn));
        r.setCheckOut(LocalDate.parse(checkIn).plusDays(3));
        r.setStatus("confirmed");
        if (email != null) {
            Guest guest = new Guest();
            guest.setEmail(email);
            r.setGuest(guest);
        }
        return r;
    }

    @Test
    void checkInWithinThreeDays_withoutEmail_emitsWarningCardWithReservation() {
        when(reservationRepository.findCurrentOrNextByPropertyId(eq(PROP), any(), eq(ORG)))
                .thenReturn(List.of(reservation("2026-07-10", null))); // J+2, pas d'email
        when(suggestionService.findPendingByTool(ORG, PROP, "guest_email_missing"))
                .thenReturn(List.of());

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).record(eq(ORG), eq(PROP), eq("com"), eq("guest_email_missing"),
                anyString(), anyString(), eq(RES_ID), eq("warning"));
    }

    @Test
    void checkInWithinThreeDays_withEmail_doesNotEmit() {
        when(reservationRepository.findCurrentOrNextByPropertyId(eq(PROP), any(), eq(ORG)))
                .thenReturn(List.of(reservation("2026-07-10", "jean@example.com")));
        when(suggestionService.findPendingByTool(ORG, PROP, "guest_email_missing"))
                .thenReturn(List.of());

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), anyString(), anyString(),
                anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void blankEmail_isTreatedAsMissing_emits() {
        when(reservationRepository.findCurrentOrNextByPropertyId(eq(PROP), any(), eq(ORG)))
                .thenReturn(List.of(reservation("2026-07-08", "   "))); // check-in aujourd'hui, email blanc
        when(suggestionService.findPendingByTool(ORG, PROP, "guest_email_missing"))
                .thenReturn(List.of());

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).record(eq(ORG), eq(PROP), eq("com"), eq("guest_email_missing"),
                anyString(), anyString(), eq(RES_ID), eq("warning"));
    }

    @Test
    void checkInBeyondHorizon_doesNotEmit() {
        when(reservationRepository.findCurrentOrNextByPropertyId(eq(PROP), any(), eq(ORG)))
                .thenReturn(List.of(reservation("2026-07-20", null))); // J+12, hors fenetre
        when(suggestionService.findPendingByTool(ORG, PROP, "guest_email_missing"))
                .thenReturn(List.of());

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), anyString(), anyString(),
                anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void cancelledReservation_doesNotEmit() {
        Reservation cancelled = reservation("2026-07-10", null);
        cancelled.setStatus("cancelled");
        when(reservationRepository.findCurrentOrNextByPropertyId(eq(PROP), any(), eq(ORG)))
                .thenReturn(List.of(cancelled));
        when(suggestionService.findPendingByTool(ORG, PROP, "guest_email_missing"))
                .thenReturn(List.of());

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), anyString(), anyString(),
                anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void pendingCard_whoseReservationNowHasEmail_isAutoResolved() {
        // La reservation a desormais un email → plus de carte a emettre, la carte PENDING est fermee.
        when(reservationRepository.findCurrentOrNextByPropertyId(eq(PROP), any(), eq(ORG)))
                .thenReturn(List.of(reservation("2026-07-10", "jean@example.com")));
        SupervisionSuggestion stale = new SupervisionSuggestion();
        stale.setId(555L);
        stale.setReservationId(RES_ID);
        when(suggestionService.findPendingByTool(ORG, PROP, "guest_email_missing"))
                .thenReturn(List.of(stale));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).dismiss(ORG, 555L);
        verify(suggestionService, never()).record(anyLong(), anyLong(), anyString(), anyString(),
                anyString(), anyString(), anyLong(), anyString());
    }
}
