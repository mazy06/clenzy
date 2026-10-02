package com.clenzy.service.tags;

import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.clenzy.service.tags.TagFormatting.formatMoney;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Detail du PDF FACTURE d'une reservation (tags {@code lignes}, {@code ligne},
 * {@code reservation.revenu_chambre}) : ventile le montant ENCAISSE
 * ({@code totalPrice}) sans jamais facturer deux fois le menage ni la taxe de sejour.
 */
@ExtendWith(MockitoExtension.class)
class ReservationTagResolverTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private EntityTagBuilders builders;

    private ReservationTagResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new ReservationTagResolver(reservationRepository, builders);
    }

    /** Sejour de 3 nuits, sans montants : chaque test pose sa ventilation. */
    private Reservation stay() {
        Reservation res = new Reservation();
        res.setId(100L);
        res.setGuestName("John Doe");
        res.setGuestCount(2);
        res.setCheckIn(LocalDate.of(2026, 3, 1));
        res.setCheckOut(LocalDate.of(2026, 3, 4));
        return res;
    }

    private Map<String, Object> resolve(Reservation res) {
        when(reservationRepository.findByIdFetchAll(100L)).thenReturn(Optional.of(res));
        Map<String, Object> context = new HashMap<>();
        resolver.resolve(100L, context);
        return context;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> lignes(Map<String, Object> context) {
        return (List<Map<String, Object>>) context.get("lignes");
    }

    private Map<String, Object> ligneStartingWith(Map<String, Object> context, String prefix) {
        return lignes(context).stream()
            .filter(ligne -> ((String) ligne.get("description")).startsWith(prefix))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Aucune ligne « " + prefix + " »"));
    }

    private static String money(String amount) {
        return formatMoney(new BigDecimal(amount));
    }

    @Nested
    class LignesDetail {

        @Test
        void whenManualReservation_thenCleaningAndTouristTaxAreNotBilledTwice() {
            // Saisie manuelle : roomRevenue null, totalPrice = hebergement 300 + menage 50 + taxe 30
            Reservation res = stay();
            res.setRoomRevenue(null);
            res.setTotalPrice(new BigDecimal("380.00"));
            res.setCleaningFee(new BigDecimal("50.00"));
            res.setTouristTaxAmount(new BigDecimal("30.00"));

            Map<String, Object> context = resolve(res);

            assertThat(lignes(context)).extracting(ligne -> ligne.get("total"))
                .containsExactly(money("300.00"), money("50.00"), money("30.00"));
            assertThat(ligneStartingWith(context, "Hebergement").get("prix_unitaire"))
                .isEqualTo(money("100.00"));
        }

        @Test
        void whenBookingEngineVoucherWasApplied_thenAccommodationCarriesTheDiscount() {
            // roomRevenue = sous-total AVANT voucher ; totalPrice = montant encaisse APRES voucher
            Reservation res = stay();
            res.setRoomRevenue(new BigDecimal("300.00"));
            res.setCleaningFee(new BigDecimal("50.00"));
            res.setTouristTaxAmount(new BigDecimal("30.00"));
            res.setDiscountAmount(new BigDecimal("38.00"));
            res.setTotalPrice(new BigDecimal("342.00"));

            Map<String, Object> context = resolve(res);

            assertThat(ligneStartingWith(context, "Hebergement").get("total"))
                .isEqualTo(money("262.00"));
        }

        @Test
        void whenChannexBookingWasModified_thenAccommodationUsesTheRefreshedTotal() {
            // roomRevenue fige a l'import (500), la revision Channex porte totalPrice a 620
            Reservation res = stay();
            res.setRoomRevenue(new BigDecimal("500.00"));
            res.setTotalPrice(new BigDecimal("620.00"));

            Map<String, Object> context = resolve(res);

            assertThat(lignes(context)).extracting(ligne -> ligne.get("total"))
                .containsExactly(money("620.00"));
        }

        @Test
        void whenBookingEngineServiceOptionsWereSold_thenTheyHaveTheirOwnLine() {
            Reservation res = stay();
            res.setRoomRevenue(new BigDecimal("300.00"));
            res.setCleaningFee(new BigDecimal("50.00"));
            res.setTouristTaxAmount(new BigDecimal("30.00"));
            res.setServiceOptionsTotal(new BigDecimal("40.00"));
            res.setTotalPrice(new BigDecimal("420.00"));

            Map<String, Object> context = resolve(res);

            assertThat(ligneStartingWith(context, "Hebergement").get("total"))
                .isEqualTo(money("300.00"));
            assertThat(ligneStartingWith(context, "Prestations complementaires").get("total"))
                .isEqualTo(money("40.00"));
        }
    }

    @Nested
    class SingleLineAndRoomRevenueTags {

        @Test
        void whenManualReservation_thenRoomRevenueTagIsTheAccommodationShare() {
            Reservation res = stay();
            res.setRoomRevenue(null);
            res.setTotalPrice(new BigDecimal("380.00"));
            res.setCleaningFee(new BigDecimal("50.00"));
            res.setTouristTaxAmount(new BigDecimal("30.00"));

            Map<String, Object> context = resolve(res);

            @SuppressWarnings("unchecked")
            Map<String, Object> reservation = (Map<String, Object>) context.get("reservation");
            assertThat(reservation.get("revenu_chambre")).isEqualTo(money("300.00"));
        }

        @Test
        void whenVoucherWasApplied_thenSingleLineUnitPriceMatchesItsTotal() {
            // Ligne unique (back-compat) : total = montant encaisse, prix unitaire = total / nuits
            Reservation res = stay();
            res.setRoomRevenue(new BigDecimal("300.00"));
            res.setTotalPrice(new BigDecimal("342.00"));

            Map<String, Object> context = resolve(res);

            @SuppressWarnings("unchecked")
            Map<String, Object> ligne = (Map<String, Object>) context.get("ligne");
            assertThat(ligne.get("total")).isEqualTo(money("342.00"));
            assertThat(ligne.get("prix_unitaire")).isEqualTo(money("114.00"));
        }
    }
}
