package com.clenzy.service.agent.simulation;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class EmpiricalElasticityEstimatorTest {

    private ReservationRepository repository;
    private EmpiricalElasticityEstimator estimator;

    @BeforeEach
    void setUp() {
        repository = mock(ReservationRepository.class);
        estimator = new EmpiricalElasticityEstimator(repository);
    }

    @Test
    void estimate_nullInputs_returnsEmpty() {
        assertTrue(estimator.estimate(null, 1L).isEmpty());
        assertTrue(estimator.estimate(1L, null).isEmpty());
        verifyNoInteractions(repository);
    }

    @Test
    void estimate_noReservations_returnsEmpty() {
        when(repository.findByPropertyIdsAndDateRange(anyList(), any(), any(), anyLong()))
                .thenReturn(List.of());

        assertTrue(estimator.estimate(1L, 42L).isEmpty());
    }

    @Test
    void estimate_lessThanThreeSignificantPairs_returnsEmpty() {
        // Seulement 2 mois → 1 paire max
        YearMonth ym1 = YearMonth.now().minusMonths(2);
        YearMonth ym2 = YearMonth.now().minusMonths(1);
        when(repository.findByPropertyIdsAndDateRange(anyList(), any(), any(), anyLong()))
                .thenReturn(List.of(
                        reservation(ym1, 10, 100), // 10 nuits a 100
                        reservation(ym2, 12, 110)  // 12 nuits a 110
                ));

        assertTrue(estimator.estimate(1L, 42L).isEmpty());
    }

    @Test
    void estimate_inverseRelation_producesPositiveElasticity() {
        // 6 mois consecutifs avec prix qui monte et occupation qui baisse
        // (= elasticite positive et significative)
        List<Reservation> data = new ArrayList<>();
        int[] nights  = {28, 25, 22, 18, 14, 10};   // occupation decroissante
        int[] prices  = {80, 88, 100, 115, 132, 152}; // prix croissant (~+10% chaque mois)
        YearMonth start = YearMonth.now().minusMonths(7);
        for (int i = 0; i < 6; i++) {
            YearMonth ym = start.plusMonths(i);
            data.add(reservation(ym, nights[i], prices[i]));
        }
        when(repository.findByPropertyIdsAndDateRange(anyList(), any(), any(), anyLong()))
                .thenReturn(data);

        Optional<EmpiricalElasticityEstimator.ElasticityEstimate> est = estimator.estimate(1L, 42L);

        assertTrue(est.isPresent(), "5 paires consecutives → estimation attendue");
        assertEquals(5, est.get().sampleSize());
        // L'elasticite doit etre positive (clamp [0.1, 1.5])
        assertTrue(est.get().elasticity() >= 0.1 && est.get().elasticity() <= 1.5,
                "Elasticite borneee : " + est.get().elasticity());
    }

    @Test
    void estimate_clampsExtremeValues_intoIndustryRange() {
        // 4 mois avec une chute occupation tres forte pour un petit changement de prix
        // → elasticite brute > 1.5 → doit etre clampee a 1.5
        List<Reservation> data = new ArrayList<>();
        YearMonth start = YearMonth.now().minusMonths(5);
        int[] nights = {28, 5, 28, 5};
        int[] prices = {100, 105, 100, 105};
        for (int i = 0; i < 4; i++) {
            data.add(reservation(start.plusMonths(i), nights[i], prices[i]));
        }
        when(repository.findByPropertyIdsAndDateRange(anyList(), any(), any(), anyLong()))
                .thenReturn(data);

        Optional<EmpiricalElasticityEstimator.ElasticityEstimate> est = estimator.estimate(1L, 42L);

        assertTrue(est.isPresent());
        // Clamp doit borner a 1.5
        assertTrue(est.get().elasticity() <= 1.5,
                "Clamp max attendu, got " + est.get().elasticity());
        assertTrue(est.get().elasticity() >= 0.1);
    }

    @Test
    void estimate_priceVariationBelowThreshold_pairsIgnored() {
        // Tous les mois ont des prix tres similaires (<2% delta) → pairs filtres
        List<Reservation> data = new ArrayList<>();
        YearMonth start = YearMonth.now().minusMonths(6);
        for (int i = 0; i < 5; i++) {
            // Prix 100.00 puis 100.50 etc → delta_pct ≈ 0.5%, < seuil 2%
            data.add(reservation(start.plusMonths(i), 15, 100 + i / 2));
        }
        when(repository.findByPropertyIdsAndDateRange(anyList(), any(), any(), anyLong()))
                .thenReturn(data);

        assertTrue(estimator.estimate(1L, 42L).isEmpty(),
                "Variations de prix non significatives → pas d'estimation");
    }

    @Test
    void estimate_repositoryFailure_returnsEmpty_doesNotThrow() {
        when(repository.findByPropertyIdsAndDateRange(anyList(), any(), any(), anyLong()))
                .thenThrow(new RuntimeException("DB down"));

        assertDoesNotThrow(() -> {
            assertTrue(estimator.estimate(1L, 42L).isEmpty());
        });
    }

    @Test
    void estimate_skipsCancelledReservations() {
        List<Reservation> data = new ArrayList<>();
        YearMonth start = YearMonth.now().minusMonths(6);
        int[] nights = {25, 20, 15, 10, 8};
        int[] prices = {100, 115, 130, 150, 170};
        for (int i = 0; i < 5; i++) {
            data.add(reservation(start.plusMonths(i), nights[i], prices[i]));
        }
        // 1 cancelled qui devrait etre ignoree (et tirerait les chiffres haut sinon)
        Reservation cancelled = reservation(start, 100, 50);
        cancelled.setStatus("cancelled");
        data.add(cancelled);
        when(repository.findByPropertyIdsAndDateRange(anyList(), any(), any(), anyLong()))
                .thenReturn(data);

        Optional<EmpiricalElasticityEstimator.ElasticityEstimate> est = estimator.estimate(1L, 42L);

        assertTrue(est.isPresent());
        // sampleSize basee sur les paires valides (5 mois → 4 paires)
        assertEquals(4, est.get().sampleSize());
    }

    /**
     * Helper : 1 reservation couvrant N nuits dans un mois donne.
     * Prix total = nuits * pricePerNight.
     */
    private static Reservation reservation(YearMonth month, int nights, int pricePerNight) {
        Reservation r = new Reservation();
        Property p = new Property();
        p.setId(42L);
        r.setProperty(p);
        LocalDate ci = month.atDay(1);
        LocalDate co = ci.plusDays(nights);
        r.setCheckIn(ci);
        r.setCheckOut(co);
        r.setStatus("confirmed");
        r.setTotalPrice(BigDecimal.valueOf((long) nights * pricePerNight));
        return r;
    }
}
