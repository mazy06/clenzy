package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fenêtre de la pré-autorisation de caution : pose le jour de l'arrivée (fuseau du logement),
 * renouvellement si le hold échoit avant la fin de la fenêtre de réclamation (départ + 2 j).
 */
class SecurityDepositHoldPolicyTest {

    private static final LocalDate ARRIVAL = LocalDate.of(2026, 10, 30);

    private static Reservation stay(String timezone, LocalDate checkIn, int nights) {
        Property property = new Property();
        property.setTimezone(timezone);
        Reservation reservation = new Reservation();
        reservation.setProperty(property);
        reservation.setCheckIn(checkIn);
        reservation.setCheckOut(checkIn.plusDays(nights));
        reservation.setStatus("confirmed");
        return reservation;
    }

    @Test
    void whenBookedThirtyDaysAhead_thenHoldIsNotDueAtBooking() {
        Reservation reservation = stay("Europe/Paris", ARRIVAL, 3);

        assertThat(SecurityDepositHoldPolicy.isHoldDue(reservation, Instant.parse("2026-09-30T10:00:00Z"))).isFalse();
    }

    @Test
    void whenItIsStillTheEveBeforeArrivalInPropertyZone_thenHoldIsNotDue() {
        // 22:30 UTC = 23:30 à Paris (UTC+1 après le passage à l'heure d'hiver du 25 octobre).
        Reservation reservation = stay("Europe/Paris", ARRIVAL, 3);

        assertThat(SecurityDepositHoldPolicy.isHoldDue(reservation, Instant.parse("2026-10-29T22:30:00Z"))).isFalse();
    }

    @Test
    void whenArrivalDayHasStartedInPropertyZone_thenHoldIsDue() {
        // 23:30 UTC = 00:30 le jour de l'arrivée à Paris.
        Reservation reservation = stay("Europe/Paris", ARRIVAL, 3);

        assertThat(SecurityDepositHoldPolicy.isHoldDue(reservation, Instant.parse("2026-10-29T23:30:00Z"))).isTrue();
    }

    @Test
    void whenPropertyIsInRiyadh_thenArrivalDayStartsEarlierThanInParis() {
        Instant now = Instant.parse("2026-10-29T21:30:00Z"); // 00:30 à Riyad, 22:30 à Paris

        assertThat(SecurityDepositHoldPolicy.isHoldDue(stay("Asia/Riyadh", ARRIVAL, 2), now)).isTrue();
        assertThat(SecurityDepositHoldPolicy.isHoldDue(stay("Europe/Paris", ARRIVAL, 2), now)).isFalse();
    }

    @Test
    void whenPropertyTimezoneIsInvalid_thenEuropeParisIsUsed() {
        Reservation reservation = stay("Mars/Olympus", ARRIVAL, 3);

        assertThat(SecurityDepositHoldPolicy.isHoldDue(reservation, Instant.parse("2026-10-29T22:30:00Z"))).isFalse();
        assertThat(SecurityDepositHoldPolicy.isHoldDue(reservation, Instant.parse("2026-10-29T23:30:00Z"))).isTrue();
    }

    @Test
    void whenStayIsOver_thenHoldIsNotDue() {
        Reservation reservation = stay("Europe/Paris", ARRIVAL, 2);

        assertThat(SecurityDepositHoldPolicy.isHoldDue(reservation, Instant.parse("2026-11-02T10:00:00Z"))).isFalse();
    }

    @Test
    void whenReservationIsCancelled_thenHoldIsNotDue() {
        Reservation reservation = stay("Europe/Paris", ARRIVAL, 2);
        reservation.markCancelled();

        assertThat(SecurityDepositHoldPolicy.isHoldDue(reservation, Instant.parse("2026-10-30T10:00:00Z"))).isFalse();
    }

    @Test
    void whenOneNightStayHeldOnArrivalDayWithShortestVisaWindow_thenNoRenewalIsNeeded() {
        // Posé à 00:10 le jour J (Paris) : échéance J+4 18:10, après la fenêtre de réclamation (J+3).
        Reservation reservation = stay("Europe/Paris", ARRIVAL, 1);
        Instant expiresAt = Instant.parse("2026-10-29T23:10:00Z").plus(SecurityDepositHoldPolicy.SHORTEST_VALIDITY);

        assertThat(SecurityDepositHoldPolicy.needsRenewal(reservation, expiresAt)).isFalse();
    }

    @Test
    void whenThreeNightStayHeldOnArrivalDay_thenHoldMustBeRenewedBeforeItLapses() {
        // Fenêtre de réclamation jusqu'à J+5 : le hold de 4 j 18 h échoit avant.
        Reservation reservation = stay("Europe/Paris", ARRIVAL, 3);
        Instant expiresAt = Instant.parse("2026-10-29T23:10:00Z").plus(SecurityDepositHoldPolicy.SHORTEST_VALIDITY);

        assertThat(SecurityDepositHoldPolicy.needsRenewal(reservation, expiresAt)).isTrue();
    }

    @Test
    void whenReservationIsCancelled_thenHoldIsNeverRenewed() {
        Reservation reservation = stay("Europe/Paris", ARRIVAL, 5);
        reservation.markCancelled();

        assertThat(SecurityDepositHoldPolicy.needsRenewal(reservation, Instant.parse("2026-11-01T12:00:00Z"))).isFalse();
    }

    @Test
    void claimWindowStaysOpenUntilTwoDaysAfterCheckout() {
        Reservation reservation = stay("Europe/Paris", ARRIVAL, 2); // départ le 1er novembre

        assertThat(SecurityDepositHoldPolicy.claimWindowEnd(reservation)).isEqualTo(LocalDate.of(2026, 11, 3));
        assertThat(SecurityDepositHoldPolicy.nothingLeftToGuarantee(reservation, Instant.parse("2026-11-03T20:00:00Z"))).isFalse();
        assertThat(SecurityDepositHoldPolicy.nothingLeftToGuarantee(reservation, Instant.parse("2026-11-03T23:30:00Z"))).isTrue();
    }
}
