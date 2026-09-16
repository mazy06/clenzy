package com.clenzy.service.assignment;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;

class AssignmentContactPreferencesTest {
    @Test void nextContactResumesAtOpeningInsteadOfTheNextPollingCycle() {
        var db=org.mockito.Mockito.mock(org.springframework.jdbc.core.JdbcTemplate.class);
        var service=new AssignmentContactPreferences(db);
        var policy=new AssignmentPolicyStore.Policy(true,true,"Europe/Paris",8,20,AssignmentDeadlinePolicy.Settings.defaults());
        assertThat(service.nextAllowed("user",9L,policy,false,Instant.parse("2026-09-16T20:03:12Z")))
                .contains(Instant.parse("2026-09-17T06:00:00Z"));
    }
    @Test void contactHoursUseTheCanonicalProfileTimezone() {
        var hours=new AssignmentContactPreferences.Preferences(8,20,false);
        var instant=Instant.parse("2026-09-16T06:30:00Z");
        assertThat(hours.allows(instant,false,"Europe/Paris")).isTrue();
        assertThat(hours.allows(instant,false,"America/New_York")).isFalse();
    }
    @Test void onCallIsExplicitAndOnlyOverridesForCriticalRequests() {
        var instant=Instant.parse("2026-09-16T23:00:00Z");
        assertThat(new AssignmentContactPreferences.Preferences(8,20,false).allows(instant,true,"UTC")).isFalse();
        var onCall=new AssignmentContactPreferences.Preferences(8,20,true);
        assertThat(onCall.allows(instant,true,"UTC")).isTrue();
        assertThat(onCall.allows(instant,false,"UTC")).isFalse();
    }
    @Test void invalidHoursCannotBeSaved() {
        assertThatThrownBy(() -> new AssignmentContactPreferences.Preferences(20,8,false)).isInstanceOf(IllegalArgumentException.class);
    }
}
