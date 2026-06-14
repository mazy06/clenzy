package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.dto.ChannexRatePlanDto;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDto;
import com.clenzy.integration.channex.dto.MappingValidationReport;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Validateur d'intégrité d'un mapping Channex (CLZ Domaine 1).
 */
class ChannexMappingValidatorTest {

    private final ChannexClient channexClient = mock(ChannexClient.class);
    private final ChannexMappingValidator validator = new ChannexMappingValidator(
        channexClient,
        mock(com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository.class));

    private ChannexPropertyMapping mapping(String roomTypeId, String defaultRatePlan, String extraRatePlans) {
        ChannexPropertyMapping m = new ChannexPropertyMapping();
        m.setChannexPropertyId("chx-prop");
        m.setChannexRoomTypeId(roomTypeId);
        m.setChannexDefaultRatePlanId(defaultRatePlan);
        m.setChannexRatePlanIds(extraRatePlans);
        return m;
    }

    private void hubHas(String roomTypeId, String... ratePlanIds) {
        when(channexClient.getProperty(eq("chx-prop")))
            .thenReturn(new ChannexPropertyDto("chx-prop", "Studio", "EUR", null, "Europe/Paris"));
        when(channexClient.fetchRoomTypesForProperty(eq("chx-prop")))
            .thenReturn(List.of(new ChannexRoomTypeDto(roomTypeId, "Std", "chx-prop", 1)));
        List<ChannexRatePlanDto> plans = java.util.Arrays.stream(ratePlanIds)
            .map(id -> new ChannexRatePlanDto(id, "RP", "chx-prop", roomTypeId, "EUR", "per_room"))
            .toList();
        when(channexClient.fetchRatePlansForProperty(eq("chx-prop"))).thenReturn(plans);
    }

    @Test
    void validMapping_noIssues() {
        hubHas("room-1", "rate-1");
        MappingValidationReport r = validator.validate(mapping("room-1", "rate-1", null));
        assertThat(r.valid()).isTrue();
        assertThat(r.issues()).isEmpty();
    }

    @Test
    void propertyMissing_invalid() {
        when(channexClient.getProperty(eq("chx-prop"))).thenReturn(null);
        MappingValidationReport r = validator.validate(mapping("room-1", "rate-1", null));
        assertThat(r.valid()).isFalse();
        assertThat(r.issues()).anyMatch(i -> i.contains("Property"));
    }

    @Test
    void roomTypeMissing_flagged() {
        hubHas("room-OTHER", "rate-1");
        MappingValidationReport r = validator.validate(mapping("room-1", "rate-1", null));
        assertThat(r.valid()).isFalse();
        assertThat(r.issues()).anyMatch(i -> i.contains("Room type") && i.contains("room-1"));
    }

    @Test
    void ratePlanMissing_flagged() {
        hubHas("room-1", "rate-1");
        MappingValidationReport r = validator.validate(mapping("room-1", "rate-MISSING", null));
        assertThat(r.valid()).isFalse();
        assertThat(r.issues()).anyMatch(i -> i.contains("Rate plan") && i.contains("rate-MISSING"));
    }

    @Test
    void multiRatePlan_oneMissing_flagged() {
        hubHas("room-1", "rate-1"); // hub n'a que rate-1
        MappingValidationReport r = validator.validate(mapping("room-1", "rate-1", "rate-2"));
        assertThat(r.valid()).isFalse();
        assertThat(r.issues()).anyMatch(i -> i.contains("rate-2"));
        assertThat(r.issues()).noneMatch(i -> i.contains("rate-1"));
    }
}
