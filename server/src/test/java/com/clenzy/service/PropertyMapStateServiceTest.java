package com.clenzy.service;

import com.clenzy.service.PropertyMapStateService.State;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class PropertyMapStateServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 10);

    @Test
    void whenStayStartsToday_thenArrival() {
        assertThat(PropertyMapStateService.stateOf(TODAY, TODAY.plusDays(3), TODAY)).isEqualTo(State.ARRIVAL);
    }

    @Test
    void whenStayEndsToday_thenDeparture() {
        assertThat(PropertyMapStateService.stateOf(TODAY.minusDays(2), TODAY, TODAY)).isEqualTo(State.DEPARTURE);
    }

    @Test
    void whenTodayIsInsideTheStay_thenOccupied() {
        assertThat(PropertyMapStateService.stateOf(TODAY.minusDays(1), TODAY.plusDays(1), TODAY)).isEqualTo(State.OCCUPIED);
    }

    @Test
    void whenStayIsOutsideToday_thenNoState() {
        assertThat(PropertyMapStateService.stateOf(TODAY.plusDays(1), TODAY.plusDays(4), TODAY)).isNull();
        assertThat(PropertyMapStateService.stateOf(null, TODAY, TODAY)).isNull();
    }

    @Test
    void whenDepartureAndArrivalSameDay_thenTurnover() {
        assertThat(PropertyMapStateService.moreUrgent(State.DEPARTURE, State.ARRIVAL)).isEqualTo(State.TURNOVER);
        assertThat(PropertyMapStateService.moreUrgent(State.OCCUPIED, State.ARRIVAL)).isEqualTo(State.ARRIVAL);
    }
}
