package com.clenzy.service;

import com.clenzy.dto.PoiSuggestionDto;
import com.clenzy.integration.overpass.OverpassPoiClient;
import com.clenzy.model.Property;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.repository.WelcomeGuideRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Suggestions de POI « autour de moi » auto-populées pour un livret, à partir des
 * coordonnées du logement (OpenStreetMap/Overpass). L'hôte importe ensuite ce qu'il garde.
 */
@Service
public class PoiSuggestionService {

    private static final int RADIUS_METERS = 1500;

    private final WelcomeGuideRepository guideRepository;
    private final OverpassPoiClient overpassPoiClient;

    public PoiSuggestionService(WelcomeGuideRepository guideRepository, OverpassPoiClient overpassPoiClient) {
        this.guideRepository = guideRepository;
        this.overpassPoiClient = overpassPoiClient;
    }

    @Transactional(readOnly = true)
    public List<PoiSuggestionDto> suggest(Long guideId, Long orgId) {
        // Staff plateforme (orgId null) : accès cross-org par id.
        WelcomeGuide guide = (orgId != null
            ? guideRepository.findByIdAndOrganizationId(guideId, orgId)
            : guideRepository.findById(guideId)).orElse(null);
        if (guide == null || guide.getProperty() == null) {
            return List.of();
        }
        Property property = guide.getProperty();
        if (property.getLatitude() == null || property.getLongitude() == null) {
            return List.of();
        }
        return overpassPoiClient.suggestNearby(
            property.getLatitude().doubleValue(), property.getLongitude().doubleValue(), RADIUS_METERS);
    }
}
