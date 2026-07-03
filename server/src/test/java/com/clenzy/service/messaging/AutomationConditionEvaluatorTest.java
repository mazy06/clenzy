package com.clenzy.service.messaging;

import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

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

    // ── Sujet generique (fireTrigger sans reservation) ──────────────────────────

    @Test
    void subjectData_nullConditions_alwaysMatches() {
        assertThat(evaluator.matchesSubjectData(null, Map.of())).isTrue();
    }

    @Test
    void subjectData_propertyIdInData_matches() {
        assertThat(evaluator.matchesSubjectData("{\"propertyIds\":[1,2,3]}",
            Map.of("propertyId", 2L))).isTrue();
    }

    @Test
    void subjectData_propertyIdAsString_matches() {
        assertThat(evaluator.matchesSubjectData("{\"propertyIds\":[42]}",
            Map.of("propertyId", "42"))).isTrue();
    }

    @Test
    void subjectData_otherProperty_doesNotMatch() {
        assertThat(evaluator.matchesSubjectData("{\"propertyIds\":[1,2,3]}",
            Map.of("propertyId", 9L))).isFalse();
    }

    @Test
    void subjectData_conditionWithoutFact_failsClosed() {
        // minNights exige des dates de sejour : un sujet qui n'en fournit pas
        // ne doit pas matcher (fail-closed, pas d'action mal ciblee).
        assertThat(evaluator.matchesSubjectData("{\"minNights\":2}",
            Map.of("propertyId", 1L))).isFalse();
    }

    @Test
    void subjectData_nightsComputedFromIsoDates() {
        Map<String, Object> data = Map.of(
            "propertyId", 1L, "checkIn", "2026-06-10", "checkOut", "2026-06-14");
        assertThat(evaluator.matchesSubjectData("{\"minNights\":2,\"maxNights\":7}", data)).isTrue();
        assertThat(evaluator.matchesSubjectData("{\"minNights\":5}", data)).isFalse();
    }

    // ── Conditions numeriques sur les data du sujet (F6b) ────────────────────

    @Test
    void numeric_gte_matchesAtAndAboveThreshold() {
        String cond = "{\"alertsLast24h\":{\"gte\":3}}";
        assertThat(evaluator.matchesSubjectData(cond, Map.of("alertsLast24h", 3))).isTrue();
        assertThat(evaluator.matchesSubjectData(cond, Map.of("alertsLast24h", 5))).isTrue();
        assertThat(evaluator.matchesSubjectData(cond, Map.of("alertsLast24h", 2))).isFalse();
    }

    @Test
    void numeric_lte_matchesAtAndBelowThreshold() {
        String cond = "{\"daysOverdue\":{\"lte\":7}}";
        assertThat(evaluator.matchesSubjectData(cond, Map.of("daysOverdue", 7))).isTrue();
        assertThat(evaluator.matchesSubjectData(cond, Map.of("daysOverdue", 3))).isTrue();
        assertThat(evaluator.matchesSubjectData(cond, Map.of("daysOverdue", 8))).isFalse();
    }

    @Test
    void numeric_eq_objectForm_matchesExactValue() {
        String cond = "{\"daysOverdue\":{\"eq\":7}}";
        assertThat(evaluator.matchesSubjectData(cond, Map.of("daysOverdue", 7))).isTrue();
        assertThat(evaluator.matchesSubjectData(cond, Map.of("daysOverdue", 6))).isFalse();
    }

    @Test
    void numeric_bareNumberShorthand_isEquality() {
        String cond = "{\"daysOverdue\":7}";
        assertThat(evaluator.matchesSubjectData(cond, Map.of("daysOverdue", 7))).isTrue();
        assertThat(evaluator.matchesSubjectData(cond, Map.of("daysOverdue", 8))).isFalse();
    }

    @Test
    void numeric_gteAndLte_combinedAsAnd() {
        String cond = "{\"alertsLast24h\":{\"gte\":2,\"lte\":4}}";
        assertThat(evaluator.matchesSubjectData(cond, Map.of("alertsLast24h", 3))).isTrue();
        assertThat(evaluator.matchesSubjectData(cond, Map.of("alertsLast24h", 1))).isFalse();
        assertThat(evaluator.matchesSubjectData(cond, Map.of("alertsLast24h", 5))).isFalse();
    }

    @Test
    void numeric_factAsString_isParsed() {
        assertThat(evaluator.matchesSubjectData("{\"alertsLast24h\":{\"gte\":3}}",
            Map.of("alertsLast24h", "4"))).isTrue();
    }

    @Test
    void numeric_conditionWithoutFact_failsClosed() {
        // Condition presente mais fait indisponible sur le sujet → fail-closed.
        assertThat(evaluator.matchesSubjectData("{\"alertsLast24h\":{\"gte\":3}}",
            Map.of("propertyId", 1L))).isFalse();
    }

    @Test
    void numeric_conditionOnReservationSubject_failsClosed() {
        // alertsLast24h n'existe pas sur une reservation : la regle ne matche pas.
        assertThat(evaluator.matches("{\"alertsLast24h\":{\"gte\":3}}",
            reservation(1L, 3, "fr"))).isFalse();
    }

    @Test
    void numeric_retroCompat_oldSchemaUnaffected() {
        // Une regle existante (sans condition numerique) matche exactement comme avant,
        // meme si le sujet porte des compteurs numeriques.
        assertThat(evaluator.matchesSubjectData("{\"propertyIds\":[1]}",
            Map.of("propertyId", 1L, "alertsLast24h", 99))).isTrue();
        // Et une condition numerique combinee au schema historique reste en ET logique.
        assertThat(evaluator.matchesSubjectData(
            "{\"propertyIds\":[1],\"alertsLast24h\":{\"gte\":3}}",
            Map.of("propertyId", 1L, "alertsLast24h", 2))).isFalse();
    }

    @Test
    void numeric_emptyObjectOrWrongType_isIgnored() {
        // Objet sans borne exploitable / type inattendu = pas de contrainte (retro-compat,
        // meme convention lenient que guestLanguage/minNights mal types).
        assertThat(evaluator.matchesSubjectData("{\"alertsLast24h\":{}}",
            Map.of("propertyId", 1L))).isTrue();
        assertThat(evaluator.matchesSubjectData("{\"alertsLast24h\":\"beaucoup\"}",
            Map.of("propertyId", 1L))).isTrue();
    }
}
