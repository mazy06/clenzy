package com.clenzy.service.messaging;

import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class AutomationConditionEvaluatorTest {

    private final AutomationConditionEvaluator evaluator =
        new AutomationConditionEvaluator(new ObjectMapper());

    private Reservation reservation(Long propertyId, int nights, String language) {
        Reservation r = new Reservation();
        r.setId(1L);
        if (propertyId != null) {
            Property p = new Property();
            p.setId(propertyId);
            r.setProperty(p);
        }
        r.setCheckIn(LocalDate.of(2026, 6, 10));
        r.setCheckOut(LocalDate.of(2026, 6, 10).plusDays(nights));
        if (language != null) {
            Guest g = new Guest();
            g.setLanguage(language);
            r.setGuest(g);
        }
        return r;
    }

    @Test
    void nullConditions_alwaysMatches() {
        assertThat(evaluator.matches(null, reservation(1L, 3, "fr"))).isTrue();
    }

    @Test
    void blankConditions_alwaysMatches() {
        assertThat(evaluator.matches("   ", reservation(1L, 3, "fr"))).isTrue();
    }

    @Test
    void emptyObject_alwaysMatches() {
        assertThat(evaluator.matches("{}", reservation(1L, 3, "fr"))).isTrue();
    }

    @Test
    void propertyIds_matchingProperty_matches() {
        assertThat(evaluator.matches("{\"propertyIds\":[1,2,3]}", reservation(2L, 3, "fr"))).isTrue();
    }

    @Test
    void propertyIds_otherProperty_doesNotMatch() {
        assertThat(evaluator.matches("{\"propertyIds\":[1,2,3]}", reservation(9L, 3, "fr"))).isFalse();
    }

    @Test
    void minNights_belowThreshold_doesNotMatch() {
        assertThat(evaluator.matches("{\"minNights\":5}", reservation(1L, 2, "fr"))).isFalse();
    }

    @Test
    void minNights_atThreshold_matches() {
        assertThat(evaluator.matches("{\"minNights\":2}", reservation(1L, 2, "fr"))).isTrue();
    }

    @Test
    void maxNights_aboveThreshold_doesNotMatch() {
        assertThat(evaluator.matches("{\"maxNights\":3}", reservation(1L, 7, "fr"))).isFalse();
    }

    @Test
    void nightsRange_within_matches() {
        assertThat(evaluator.matches("{\"minNights\":2,\"maxNights\":7}", reservation(1L, 4, "fr"))).isTrue();
    }

    @Test
    void guestLanguage_caseInsensitiveMatch() {
        assertThat(evaluator.matches("{\"guestLanguage\":\"FR\"}", reservation(1L, 3, "fr"))).isTrue();
    }

    @Test
    void guestLanguage_mismatch_doesNotMatch() {
        assertThat(evaluator.matches("{\"guestLanguage\":\"en\"}", reservation(1L, 3, "fr"))).isFalse();
    }

    @Test
    void guestLanguage_noGuest_doesNotMatch() {
        assertThat(evaluator.matches("{\"guestLanguage\":\"fr\"}", reservation(1L, 3, null))).isFalse();
    }

    @Test
    void combinedConditions_allMatch_matches() {
        String conditions = "{\"propertyIds\":[2],\"minNights\":2,\"maxNights\":7,\"guestLanguage\":\"fr\"}";
        assertThat(evaluator.matches(conditions, reservation(2L, 4, "fr"))).isTrue();
    }

    @Test
    void combinedConditions_oneFails_doesNotMatch() {
        String conditions = "{\"propertyIds\":[2],\"minNights\":2,\"guestLanguage\":\"en\"}";
        assertThat(evaluator.matches(conditions, reservation(2L, 4, "fr"))).isFalse();
    }

    @Test
    void malformedJson_failsClosed() {
        assertThat(evaluator.matches("{not valid json", reservation(1L, 3, "fr"))).isFalse();
    }

    @Test
    void nightsCondition_missingDates_doesNotMatch() {
        Reservation r = new Reservation();
        r.setId(1L);
        // pas de checkIn/checkOut
        assertThat(evaluator.matches("{\"minNights\":1}", r)).isFalse();
    }
}
