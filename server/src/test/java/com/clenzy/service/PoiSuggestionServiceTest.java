package com.clenzy.service;

import com.clenzy.dto.PoiSuggestionDto;
import com.clenzy.integration.overpass.OverpassPoiClient;
import com.clenzy.model.Property;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.repository.WelcomeGuideRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PoiSuggestionServiceTest {

    @Mock private WelcomeGuideRepository guideRepository;
    @Mock private OverpassPoiClient overpassPoiClient;

    private PoiSuggestionService service() {
        return new PoiSuggestionService(guideRepository, overpassPoiClient);
    }

    private WelcomeGuide guideWithCoords(BigDecimal lat, BigDecimal lng) {
        Property property = new Property();
        property.setLatitude(lat);
        property.setLongitude(lng);
        WelcomeGuide guide = new WelcomeGuide();
        guide.setProperty(property);
        return guide;
    }

    @Test
    void suggest_withCoords_delegatesToOverpass() {
        when(guideRepository.findByIdAndOrganizationId(1L, 7L))
            .thenReturn(Optional.of(guideWithCoords(new BigDecimal("48.8566"), new BigDecimal("2.3522"))));
        List<PoiSuggestionDto> expected = List.of(new PoiSuggestionDto("RESTAURANT", "Chez X", "12 rue Y", 48.85, 2.35));
        when(overpassPoiClient.suggestNearby(anyDouble(), anyDouble(), anyInt())).thenReturn(expected);

        List<PoiSuggestionDto> result = service().suggest(1L, 7L);

        assertThat(result).isEqualTo(expected);
    }

    @Test
    void suggest_noCoords_returnsEmptyWithoutCallingOverpass() {
        when(guideRepository.findByIdAndOrganizationId(1L, 7L))
            .thenReturn(Optional.of(guideWithCoords(null, null)));

        List<PoiSuggestionDto> result = service().suggest(1L, 7L);

        assertThat(result).isEmpty();
        verify(overpassPoiClient, never()).suggestNearby(anyDouble(), anyDouble(), anyInt());
    }

    @Test
    void suggest_guideNotFound_returnsEmpty() {
        when(guideRepository.findByIdAndOrganizationId(99L, 7L)).thenReturn(Optional.empty());

        assertThat(service().suggest(99L, 7L)).isEmpty();
        verify(overpassPoiClient, never()).suggestNearby(anyDouble(), anyDouble(), anyInt());
    }
}
