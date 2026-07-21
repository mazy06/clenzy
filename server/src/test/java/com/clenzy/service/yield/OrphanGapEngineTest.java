package com.clenzy.service.yield;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class OrphanGapEngineTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 7, 20);

    @Test
    void whenShortGapBetweenTwoBookings_thenAllGapNightsFlagged() {
        // Occupé les 22 et 25 : creux de 2 nuits (23, 24) encadré des deux côtés.
        Set<LocalDate> occupied = Set.of(TODAY.plusDays(2), TODAY.plusDays(5));

        Map<LocalDate, Integer> orphans =
                OrphanGapEngine.findOrphanGaps(occupied, TODAY, 60, 3);

        assertThat(orphans).containsOnlyKeys(TODAY.plusDays(3), TODAY.plusDays(4));
        assertThat(orphans.values()).containsOnly(2);
    }

    @Test
    void whenGapLongerThanMax_thenIgnored() {
        // Creux de 4 nuits avec max 3 : pas orphelin.
        Set<LocalDate> occupied = Set.of(TODAY.plusDays(2), TODAY.plusDays(7));

        assertThat(OrphanGapEngine.findOrphanGaps(occupied, TODAY, 60, 3)).isEmpty();
    }

    @Test
    void whenGapNotBoundedOnBothSides_thenIgnored() {
        // Une seule réservation : les nuits libres autour ne sont pas des creux
        // encadrés — rien à remiser (elles peuvent encore se vendre normalement).
        Set<LocalDate> occupied = Set.of(TODAY.plusDays(10));

        assertThat(OrphanGapEngine.findOrphanGaps(occupied, TODAY, 60, 3)).isEmpty();
    }

    @Test
    void whenGapAdjacentToToday_thenOnlyFlaggedIfTodayOccupied() {
        // Nuit libre demain entre aujourd'hui (occupé) et après-demain (occupé).
        Set<LocalDate> occupied = Set.of(TODAY, TODAY.plusDays(2));

        Map<LocalDate, Integer> orphans =
                OrphanGapEngine.findOrphanGaps(occupied, TODAY, 60, 3);

        assertThat(orphans).containsOnlyKeys(TODAY.plusDays(1));
    }

    @Test
    void whenDiscountGoesBelowFloor_thenClampedToFloor() {
        BigDecimal target = OrphanGapEngine.discounted(
                new BigDecimal("100.00"), new BigDecimal("15"), new BigDecimal("90.00"));
        assertThat(target).isEqualByComparingTo("90.00");

        BigDecimal aboveFloor = OrphanGapEngine.discounted(
                new BigDecimal("100.00"), new BigDecimal("15"), new BigDecimal("50.00"));
        assertThat(aboveFloor).isEqualByComparingTo("85.00");
    }
}
