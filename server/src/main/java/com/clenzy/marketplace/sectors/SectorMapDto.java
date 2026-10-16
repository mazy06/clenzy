package com.clenzy.marketplace.sectors;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Carte des secteurs d'intervention : un contour fusionné par prestataire, l'union de tous
 * ({@code merged}, secteurs voisins réunis sous une seule bordure) et les logements de
 * l'organisation avec les prestataires qui les couvrent selon la règle d'affectation.
 *
 * <p>Les géométries sont du GeoJSON (Polygon / MultiPolygon), {@code null} si aucune zone
 * déclarée n'a de contour connu.</p>
 */
public record SectorMapDto(List<ProviderSectors> providers, Map<String, Object> merged,
                           List<SectorProperty> properties, String attribution) {

    /**
     * Secteur d'un prestataire : ses zones, leur contour réuni et sa photo (null : initiales).
     * {@code userId} : son compte PMS, celui que portent ses interventions assignées (null s'il n'en a pas).
     */
    public record ProviderSectors(Long providerId, String name, String avatarUrl, Map<String, Object> geometry,
                                  List<Zone> zones, Long userId) {
        public ProviderSectors withUserId(Long accountId) {
            return new ProviderSectors(providerId, name, avatarUrl, geometry, zones, accountId);
        }
    }

    /** Une zone déclarée ; {@code drawn = false} : nommée, mais sans contour connu. */
    public record Zone(String key, String name, String kind, boolean approx, boolean drawn) {
    }

    /** Logement de l'organisation ; {@code coveredBy} : prestataires dont le secteur l'inclut. */
    public record SectorProperty(Long id, String name, BigDecimal latitude, BigDecimal longitude,
                                 List<Long> coveredBy) {
    }
}
