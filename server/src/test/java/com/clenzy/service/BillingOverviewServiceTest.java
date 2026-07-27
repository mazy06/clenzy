package com.clenzy.service;

import com.clenzy.dto.BillingOverviewDto;
import com.clenzy.dto.ChannelRevenueDto;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Widget « Revenus par canal » : catalogue complet renvoye a chaque appel,
 * classement par revenu decroissant, et resolution du canal depuis le nom de
 * source (seul a distinguer Vrbo d'Expedia).
 */
@ExtendWith(MockitoExtension.class)
class BillingOverviewServiceTest {

    @Mock private ReservationRepository reservationRepository;

    private BillingOverviewService service;

    private static final Long ORG = 1L;
    private static final LocalDate TODAY = LocalDate.of(2026, 6, 15);

    @BeforeEach
    void setUp() {
        service = new BillingOverviewService(reservationRepository);
    }

    /** Reservation minimale : seuls le canal et le montant comptent ici. */
    private Reservation booking(String source, String sourceName, String amount) {
        Reservation reservation = new Reservation();
        reservation.setSource(source);
        reservation.setSourceName(sourceName);
        reservation.setTotalPrice(new BigDecimal(amount));
        return reservation;
    }

    private void givenPeriods(List<Reservation> current, List<Reservation> previous) {
        when(reservationRepository.findBookedByCheckInRange(
                eq(LocalDate.of(2026, 6, 1)), any(LocalDate.class), eq(ORG)))
            .thenReturn(current);
        when(reservationRepository.findBookedByCheckInRange(
                eq(LocalDate.of(2026, 5, 1)), any(LocalDate.class), eq(ORG)))
            .thenReturn(previous);
    }

    private BillingOverviewDto currentMonth() {
        return service.getBillingOverview(ORG, "MAD", TODAY, "month");
    }

    @Test
    void whenOnlyOneChannelSells_thenEveryCatalogChannelIsStillReturned() {
        givenPeriods(List.of(booking("airbnb", "Airbnb", "1000")), List.of());

        List<ChannelRevenueDto> channels = currentMonth().channels();

        assertThat(channels).extracting(ChannelRevenueDto::source)
            .containsExactlyInAnyOrder("airbnb", "booking", "vrbo", "expedia", "direct", "other");
        assertThat(channels).filteredOn(c -> !"airbnb".equals(c.source()))
            .allSatisfy(c -> assertThat(c.amount()).isEqualByComparingTo(BigDecimal.ZERO));
    }

    @Test
    void whenChannelsHaveRevenue_thenTheyAreRankedFromHighestToLowest() {
        givenPeriods(
            List.of(
                booking("direct", null, "300"),
                booking("airbnb", "Airbnb", "1000"),
                booking("booking", "Booking.com", "500")),
            List.of());

        List<ChannelRevenueDto> channels = currentMonth().channels();

        assertThat(channels).extracting(ChannelRevenueDto::source)
            .startsWith("airbnb", "booking", "direct");
    }

    @Test
    void whenChannelsTieAtZero_thenCatalogOrderIsPreserved() {
        givenPeriods(List.of(booking("airbnb", "Airbnb", "1000")), List.of());

        List<ChannelRevenueDto> channels = currentMonth().channels();

        assertThat(channels).extracting(ChannelRevenueDto::source)
            .containsExactly("airbnb", "booking", "vrbo", "expedia", "direct", "other");
    }

    /**
     * `Reservation.source` replie Vrbo sur "other" (taxonomie lue par la
     * facturation, cf. BillingOverviewService.SOURCE_NAME_KEYWORDS) : sans la
     * resolution par nom de source, ce revenu atterrirait dans « Autre ».
     */
    @Test
    void whenSourceIsGenericButSourceNameNamesTheOta_thenRevenueGoesToThatChannel() {
        givenPeriods(
            List.of(
                booking("other", "Vrbo", "800"),
                booking("channex", "Expedia", "400"),
                booking("other", "Calendrier perso", "100")),
            List.of());

        List<ChannelRevenueDto> channels = currentMonth().channels();

        assertThat(channels).filteredOn(c -> "vrbo".equals(c.source())).singleElement()
            .satisfies(c -> assertThat(c.amount()).isEqualByComparingTo("800.00"));
        assertThat(channels).filteredOn(c -> "expedia".equals(c.source())).singleElement()
            .satisfies(c -> assertThat(c.amount()).isEqualByComparingTo("400.00"));
        assertThat(channels).filteredOn(c -> "other".equals(c.source())).singleElement()
            .satisfies(c -> assertThat(c.amount()).isEqualByComparingTo("100.00"));
    }

    @Test
    void whenChannelFellToZero_thenItsPreviousShareIsReportedForTheDelta() {
        givenPeriods(
            List.of(booking("airbnb", "Airbnb", "1000")),
            List.of(booking("booking", "Booking.com", "400")));

        ChannelRevenueDto bookingChannel = currentMonth().channels().stream()
            .filter(c -> "booking".equals(c.source())).findFirst().orElseThrow();

        assertThat(bookingChannel.amount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(bookingChannel.pct()).isZero();
        assertThat(bookingChannel.comparePct()).isEqualTo(100.0);
    }

    @Test
    void whenPreviousPeriodIsEmpty_thenNoComparisonIsReported() {
        givenPeriods(List.of(booking("airbnb", "Airbnb", "1000")), List.of());

        assertThat(currentMonth().channels())
            .allSatisfy(channel -> assertThat(channel.comparePct()).isNull());
    }
}
