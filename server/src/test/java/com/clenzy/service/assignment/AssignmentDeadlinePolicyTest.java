package com.clenzy.service.assignment;

import org.junit.jupiter.api.Test;
import java.time.*;
import static org.assertj.core.api.Assertions.*;

class AssignmentDeadlinePolicyTest {
    private final Instant now = Instant.parse("2026-09-16T08:00:00Z");
    private final AssignmentDeadlinePolicy.Settings settings = AssignmentDeadlinePolicy.Settings.defaults();

    @Test void exactBoundariesAndUnscheduledNeedsUseTheApprovedDelays() {
        assertThat(deadline(48 * 60 + 1, false)).isEqualTo(now.plusSeconds(12 * 3600));
        assertThat(deadline(48 * 60, false)).isEqualTo(now.plusSeconds(2 * 3600));
        assertThat(deadline(6 * 60, false)).isEqualTo(now.plusSeconds(2 * 3600));
        assertThat(deadline(6 * 60 - 1, false)).isEqualTo(now.plusSeconds(30 * 60));
        assertThat(deadline(24 * 60, true)).isEqualTo(now.plusSeconds(15 * 60));
        assertThat(AssignmentDeadlinePolicy.expiresAt(now, null, false, settings)).isEqualTo(now.plusSeconds(86400));
    }

    @Test void preparationMarginWinsAndEqualityNeverPermitsAcceptance() {
        assertThat(deadline(40, false)).isEqualTo(now.plusSeconds(600));
        assertThat(deadline(30, false)).isEqualTo(now);
        assertThat(AssignmentDeadlinePolicy.canRespond(now, now)).isFalse();
        assertThat(AssignmentDeadlinePolicy.canRespond(now, now.minusNanos(1))).isFalse();
        assertThat(AssignmentDeadlinePolicy.canRespond(now, now.plusNanos(1))).isTrue();
    }

    @Test void daylightSavingNeverChangesAnAnnouncedInstant() {
        var before = ZonedDateTime.of(2026, 10, 25, 1, 30, 0, 0, ZoneId.of("Europe/Paris")).toInstant();
        var expires = AssignmentDeadlinePolicy.expiresAt(before, null, false, settings);
        assertThat(Duration.between(before, expires)).isEqualTo(Duration.ofHours(24));
        assertThat(expires.atZone(ZoneId.of("America/New_York")).toInstant()).isEqualTo(expires);
    }

    private Instant deadline(int startInMinutes, boolean critical) {
        return AssignmentDeadlinePolicy.expiresAt(now, now.plusSeconds(startInMinutes * 60L), critical, settings);
    }
}
