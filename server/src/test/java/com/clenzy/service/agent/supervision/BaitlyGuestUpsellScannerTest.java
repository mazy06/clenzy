package com.clenzy.service.agent.supervision;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.UpsellOffer;
import com.clenzy.model.UpsellTypes;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UpsellOfferRepository;
import com.clenzy.service.WelcomeGuideService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Régression Baitly : les codes issus de la base sont des valeurs, pas des références Java. */
class BaitlyGuestUpsellScannerTest {
    private final ReservationRepository reservations = mock(ReservationRepository.class);
    private final UpsellOfferRepository offers = mock(UpsellOfferRepository.class);
    private final WelcomeGuideService guides = mock(WelcomeGuideService.class);
    private final SupervisionSuggestionService suggestions = mock(SupervisionSuggestionService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-19T12:00:00Z"), ZoneOffset.UTC);
    private final GuestUpsellScanner scanner = new GuestUpsellScanner(reservations, offers, guides, suggestions, clock);

    private Reservation stay(String type) {
        var property = new Property(); property.setId(7L); property.setTimezone("Europe/Paris");
        var stay = new Reservation(); stay.setId(50L); stay.setProperty(property);
        stay.setGuestName("Voyageur de test"); stay.setPaymentLinkEmail("guest@example.test");
        stay.setCheckIn(LocalDate.parse(type.equals(UpsellTypes.EARLY_CHECKIN) ? "2026-10-20" : "2026-10-18"));
        stay.setCheckOut(LocalDate.parse(type.equals(UpsellTypes.EARLY_CHECKIN) ? "2026-10-22" : "2026-10-20"));
        return stay;
    }

    private UpsellOffer offer(String type, Long propertyId) {
        var offer = new UpsellOffer(); offer.setId(12L); offer.setPropertyId(propertyId);
        offer.setType(new String(type)); offer.setPrice(new BigDecimal("15")); offer.setTitle("Horaire flexible");
        return offer;
    }

    @ParameterizedTest
    @ValueSource(strings = { "EARLY_CHECKIN", "LATE_CHECKOUT" })
    void proposesExistingOffersLoadedFromDatabase(String type) {
        var stay = stay(type);
        when(offers.findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(1L)).thenReturn(List.of(offer(type, 7L)));
        when(reservations.findCurrentOrNextByPropertyId(7L, LocalDate.parse("2026-10-19"), 1L)).thenReturn(List.of(stay));
        when(guides.hasPublishedGuideFor(stay)).thenReturn(true);
        scanner.scanProperty(1L, 7L);
        verify(suggestions).recordActionableStrict(eq(1L), eq(7L), eq("gst"), eq(50L), anyString(), anyString(),
                eq(SupervisionActionType.UPSELL_OFFER), eq("{\"reservationId\":50,\"offerId\":12}"), eq(1500L), eq("info"));
    }

    @Test
    void neverProposesAnOfferForAnotherProperty() {
        when(offers.findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(1L))
                .thenReturn(List.of(offer(UpsellTypes.EARLY_CHECKIN, 99L)));
        scanner.scanProperty(1L, 7L);
        verifyNoInteractions(reservations, suggestions);
    }

    @ParameterizedTest
    @ValueSource(strings = { "EARLY_CHECKIN", "LATE_CHECKOUT" })
    void doesNotProposeAConflictingTurnover(String type) {
        var stay = stay(type);
        var adjacent = new Reservation(); adjacent.setId(51L);
        adjacent.setCheckIn(type.equals(UpsellTypes.LATE_CHECKOUT) ? stay.getCheckOut() : stay.getCheckIn().minusDays(2));
        adjacent.setCheckOut(type.equals(UpsellTypes.EARLY_CHECKIN) ? stay.getCheckIn() : stay.getCheckOut().plusDays(2));
        when(offers.findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(1L)).thenReturn(List.of(offer(type, null)));
        when(reservations.findCurrentOrNextByPropertyId(7L, LocalDate.parse("2026-10-19"), 1L)).thenReturn(List.of(stay, adjacent));
        when(guides.hasPublishedGuideFor(stay)).thenReturn(true);
        scanner.scanProperty(1L, 7L);
        verifyNoInteractions(suggestions);
    }
}
