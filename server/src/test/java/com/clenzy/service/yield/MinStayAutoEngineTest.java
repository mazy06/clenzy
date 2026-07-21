package com.clenzy.service.yield;

import com.clenzy.model.YieldOrgConfig;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class MinStayAutoEngineTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 7, 20);

    private static YieldOrgConfig config(int withinDays, int reducedValue) {
        YieldOrgConfig c = new YieldOrgConfig(10L);
        c.setMinStayReduceWithinDays(withinDays);
        c.setMinStayReducedValue(reducedValue);
        return c;
    }

    @Test
    void whenBaseMinStayHigher_thenFreeNightsInWindowReduced() {
        // Base 3 nuits, fenêtre 7 j, la nuit +2 est occupée : 6 nuits à réduire.
        Set<LocalDate> desired = MinStayAutoEngine.desiredReductions(
                3, config(7, 1), Set.of(TODAY.plusDays(2)), TODAY);

        assertThat(desired).hasSize(6);
        assertThat(desired).contains(TODAY, TODAY.plusDays(6));
        assertThat(desired).doesNotContain(TODAY.plusDays(2), TODAY.plusDays(7));
    }

    @Test
    void whenBaseMinStayAlreadyLow_thenNothingToReduce() {
        assertThat(MinStayAutoEngine.desiredReductions(1, config(14, 1), Set.of(), TODAY)).isEmpty();
        assertThat(MinStayAutoEngine.desiredReductions(null, config(14, 1), Set.of(), TODAY)).isEmpty();
    }
}
