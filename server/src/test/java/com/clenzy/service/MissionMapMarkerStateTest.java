package com.clenzy.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class MissionMapMarkerStateTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 10, 12, 0);

    @Test
    void whenOpenMissionIsPastDue_thenLate() {
        assertThat(MissionMapQueryService.markerState("SCHEDULED", NOW.minusHours(1), NOW)).isEqualTo("late");
    }

    @Test
    void whenMissionLaterToday_thenToday() {
        assertThat(MissionMapQueryService.markerState("SCHEDULED", NOW.plusHours(3), NOW)).isEqualTo("today");
    }

    @Test
    void whenMissionFinishedOrCancelled_thenNeverLate() {
        assertThat(MissionMapQueryService.markerState("COMPLETED", NOW.minusDays(2), NOW)).isEqualTo("done");
        assertThat(MissionMapQueryService.markerState("CANCELLED", NOW.minusDays(2), NOW)).isEqualTo("closed");
    }

    @Test
    void whenMissionIsLaterOrUndated_thenPlanned() {
        assertThat(MissionMapQueryService.markerState("PENDING", NOW.plusDays(2), NOW)).isEqualTo("planned");
        assertThat(MissionMapQueryService.markerState("PENDING", null, NOW)).isEqualTo("planned");
    }
}
