package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.dto.RestrictionDivergence;
import com.clenzy.model.BookingRestriction;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Détecteur de divergence de restrictions Clenzy ↔ OTA (CLZ Domaine 1) — fonction pure.
 */
class RestrictionDivergenceDetectorTest {

    private final RestrictionDivergenceDetector detector = new RestrictionDivergenceDetector();
    private final ObjectMapper mapper = new ObjectMapper();

    private BookingRestriction local(Integer minStay, Integer minStayArrival, boolean cta, boolean ctd) {
        BookingRestriction b = new BookingRestriction();
        b.setMinStay(minStay);
        b.setMinStayArrival(minStayArrival);
        b.setClosedToArrival(cta);
        b.setClosedToDeparture(ctd);
        return b;
    }

    private ObjectNode remote(Integer minStayThrough, Integer minStayArrival, Boolean cta, Boolean ctd) {
        ObjectNode n = mapper.createObjectNode();
        if (minStayThrough != null) n.put("min_stay_through", minStayThrough);
        if (minStayArrival != null) n.put("min_stay_arrival", minStayArrival);
        if (cta != null) n.put("closed_to_arrival", cta);
        if (ctd != null) n.put("closed_to_departure", ctd);
        return n;
    }

    @Test
    void identicalRestrictions_noDivergence() {
        assertThat(detector.detect(local(3, 2, true, false), remote(3, 2, true, false))).isEmpty();
    }

    @Test
    void noLocalNoRemote_noDivergence() {
        assertThat(detector.detect(null, remote(null, null, null, null))).isEmpty();
    }

    @Test
    void minStayThroughDiffers_flagged() {
        List<RestrictionDivergence> d = detector.detect(local(3, null, false, false),
            remote(2, null, false, false));
        assertThat(d).hasSize(1);
        assertThat(d.get(0).field()).isEqualTo("min_stay_through");
        assertThat(d.get(0).localValue()).isEqualTo("3");
        assertThat(d.get(0).otaValue()).isEqualTo("2");
    }

    @Test
    void localMinStayArrivalButRemoteAbsent_flagged() {
        List<RestrictionDivergence> d = detector.detect(local(null, 2, false, false),
            remote(null, null, false, false));
        assertThat(d).extracting(RestrictionDivergence::field).containsExactly("min_stay_arrival");
        assertThat(d.get(0).localValue()).isEqualTo("2");
        assertThat(d.get(0).otaValue()).isEqualTo("-");
    }

    @Test
    void closedToArrivalDiffers_flagged() {
        List<RestrictionDivergence> d = detector.detect(local(null, null, true, false),
            remote(null, null, false, false));
        assertThat(d).extracting(RestrictionDivergence::field).containsExactly("closed_to_arrival");
    }

    @Test
    void otaHasRestrictionButNoLocal_flagged() {
        List<RestrictionDivergence> d = detector.detect(null, remote(5, null, null, null));
        assertThat(d).extracting(RestrictionDivergence::field).containsExactly("min_stay_through");
        assertThat(d.get(0).localValue()).isEqualTo("-");
        assertThat(d.get(0).otaValue()).isEqualTo("5");
    }

    @Test
    void multipleFieldsDiffer_allFlagged() {
        List<RestrictionDivergence> d = detector.detect(local(3, 2, true, true),
            remote(1, 1, false, false));
        assertThat(d).extracting(RestrictionDivergence::field)
            .containsExactlyInAnyOrder("min_stay_through", "min_stay_arrival",
                "closed_to_arrival", "closed_to_departure");
    }
}
