package com.clenzy.booking.service;

import com.clenzy.booking.dto.AvailabilityRequestDto;
import com.clenzy.booking.dto.AvailabilityResponseDto;
import com.clenzy.booking.dto.BookingCheckoutRequestDto;
import com.clenzy.booking.dto.BookingCheckoutResponseDto;
import com.clenzy.booking.dto.BookingReserveRequestDto;
import com.clenzy.booking.dto.BookingReserveResponseDto;
import com.clenzy.booking.dto.PropertyCalendarDto;
import com.clenzy.booking.dto.PropertyCalendarDto.CalendarDayDto;
import com.clenzy.booking.dto.PropertySearchFilters;
import com.clenzy.booking.dto.PublicPropertyDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires PURS de {@link BookingMockDataProvider} (jeu de démo Baitly, déterministe).
 *
 * <p>Aucun Spring, aucun mock : on instancie directement le composant pur et on vérifie les
 * invariants documentés (ids stables 9001..9006, déterminisme, motif de blocage {@code jour % 7 == 0},
 * codes/URL simulés sans effet réel).</p>
 */
class BookingMockDataProviderTest {

    /** Logement de démo de référence (Villa Azur). */
    private static final Long DEMO_PROPERTY_ID = 9001L;

    /** Mois futur fixe → dates déterministes et toujours dans le futur. */
    private static final YearMonth DEMO_MONTH = YearMonth.of(2030, 1);

    private BookingMockDataProvider provider;

    @BeforeEach
    void setUp() {
        provider = new BookingMockDataProvider();
    }

    // ───────────────────── getProperties ─────────────────────────────────────────

    @Test
    @DisplayName("getProperties(NONE) renvoie les 6 logements de démo (ids 9001..9006)")
    void whenNoFilter_getProperties_returnsSixDemoPropertiesWithStableIds() {
        // Arrange + Act
        List<PublicPropertyDto> result = provider.getProperties(PropertySearchFilters.NONE, null);

        // Assert
        assertThat(result).hasSize(6);
        assertThat(result).extracting(PublicPropertyDto::id)
                .containsExactly(9001L, 9002L, 9003L, 9004L, 9005L, 9006L);
        assertThat(result).allSatisfy(p -> assertThat(p.id()).isBetween(9001L, 9006L));
    }

    @Test
    @DisplayName("getProperties est déterministe : deux appels renvoient le même jeu (ids + taille)")
    void whenCalledTwice_getProperties_isDeterministic() {
        // Arrange + Act
        List<PublicPropertyDto> first = provider.getProperties(PropertySearchFilters.NONE, null);
        List<PublicPropertyDto> second = provider.getProperties(PropertySearchFilters.NONE, null);

        // Assert
        assertThat(second).hasSameSizeAs(first);
        assertThat(second).extracting(PublicPropertyDto::id)
                .containsExactlyElementsOf(first.stream().map(PublicPropertyDto::id).toList());
    }

    // ───────────────────── getCalendar ───────────────────────────────────────────

    @Test
    @DisplayName("getCalendar bloque les jours où jour % 7 == 0 et laisse les autres disponibles")
    void whenCalendar_thenSeventhDaysBlockedAndNormalDaysAvailable() {
        // Arrange + Act
        PropertyCalendarDto calendar = provider.getCalendar(DEMO_PROPERTY_ID, DEMO_MONTH, 1);

        // Assert
        assertThat(calendar.days()).isNotEmpty();

        CalendarDayDto blockedDay = dayOf(calendar, DEMO_MONTH.atDay(7)); // 7 % 7 == 0
        assertThat(blockedDay.available()).isFalse();
        assertThat(blockedDay.price()).isNull();

        CalendarDayDto normalDay = dayOf(calendar, DEMO_MONTH.atDay(3)); // 3 % 7 != 0
        assertThat(normalDay.available()).isTrue();
        assertThat(normalDay.price()).isNotNull();
    }

    // ───────────────────── checkAvailability ─────────────────────────────────────

    @Test
    @DisplayName("checkAvailability sur des nuits non bloquées → available avec total > 0")
    void whenStayHasNoBlockedNight_thenAvailableWithPositiveTotal() {
        // Arrange : arrivée le 3, départ le 6 → nuits 3/4/5, aucun multiple de 7.
        LocalDate checkIn = DEMO_MONTH.atDay(3);
        LocalDate checkOut = DEMO_MONTH.atDay(6);
        AvailabilityRequestDto req = new AvailabilityRequestDto(DEMO_PROPERTY_ID, checkIn, checkOut, 2);

        // Act
        AvailabilityResponseDto resp = provider.checkAvailability(req);

        // Assert
        assertThat(resp.available()).isTrue();
        assertThat(resp.nights()).isEqualTo(3);
        assertThat(resp.breakdown()).hasSize(3);
        assertThat(resp.total()).isGreaterThan(java.math.BigDecimal.ZERO);
    }

    // ───────────────────── reserve ────────────────────────────────────────────────

    @Test
    @DisplayName("reserve renvoie un DTO simulé PENDING avec le code MOCK-<id>-<checkIn>")
    void whenReserve_thenReturnsSimulatedPendingWithMockCode() {
        // Arrange
        LocalDate checkIn = DEMO_MONTH.atDay(3);
        LocalDate checkOut = DEMO_MONTH.atDay(6);
        BookingReserveRequestDto req = new BookingReserveRequestDto(
                DEMO_PROPERTY_ID, checkIn, checkOut, 2,
                new BookingReserveRequestDto.GuestInfo("Jane Démo", "jane@example.com", "+33600000000"),
                "Notes démo",
                null, null);

        // Act
        BookingReserveResponseDto resp = provider.reserve(req);

        // Assert
        assertThat(resp).isNotNull();
        assertThat(resp.reservationCode()).isEqualTo("MOCK-9001-" + checkIn);
        assertThat(resp.status()).isEqualTo("PENDING");
        assertThat(resp.total()).isGreaterThan(java.math.BigDecimal.ZERO);
        assertThat(resp.expiresAt()).isNotNull();
        assertThat(resp.requiresPayment()).isTrue();
    }

    // ───────────────────── checkout ────────────────────────────────────────────────

    @Test
    @DisplayName("checkout renvoie une URL/sessionId simulés (jamais une vraie URL Stripe)")
    void whenCheckout_thenReturnsSimulatedUrlAndSessionId() {
        // Arrange
        BookingCheckoutRequestDto req = new BookingCheckoutRequestDto("MOCK-9001-2030-01-03", null);

        // Act
        BookingCheckoutResponseDto resp = provider.checkout(req);

        // Assert
        assertThat(resp).isNotNull();
        assertThat(resp.checkoutUrl()).isEqualTo("/booking/confirmation?ref=MOCK-9001-2030-01-03&mock=true");
        assertThat(resp.sessionId()).isEqualTo("mock_session_MOCK-9001-2030-01-03");
        // Garde-fou : aucune redirection vers Stripe en mode démo.
        assertThat(resp.checkoutUrl()).doesNotContain("stripe");
        assertThat(resp.checkoutUrl()).startsWith("/booking/confirmation");
    }

    // ───────────────────── helpers ────────────────────────────────────────────────

    private static CalendarDayDto dayOf(PropertyCalendarDto calendar, LocalDate date) {
        return calendar.days().stream()
                .filter(d -> d.date().equals(date))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Jour absent du calendrier de démo : " + date));
    }
}
