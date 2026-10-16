package com.clenzy.marketplace.sectors;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository.EffectiveZone;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository.PropertyCoverage;
import com.clenzy.marketplace.service.MarketplaceCatalogService;
import com.clenzy.marketplace.service.MarketplaceExposureService;
import com.clenzy.repository.PropertyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Secteurs des prestataires vus par une organisation, avec ses logements.
 *
 * <p>« Couvert » suit la règle d'affectation (secteur déclaré ou rayon depuis la base) : la carte dit toujours ce que le
 * moteur d'affectation décidera. Seuls les prestataires visibles de l'organisation dans le
 * catalogue apparaissent ; un prestataire masqué répond comme inexistant.</p>
 *
 * <p>Un hôte ne voit que ses propres logements ({@code hostSubject}), comme au planning.</p>
 */
@Service
public class ProviderSectorMapService {

    private final MarketplaceCatalogService catalog;
    private final MarketplaceExposureService exposure;
    private final MarketplaceProviderZoneRepository zones;
    private final PropertyRepository properties;
    private final SectorShapes shapes;

    public ProviderSectorMapService(MarketplaceCatalogService catalog, MarketplaceExposureService exposure,
                                    MarketplaceProviderZoneRepository zones, PropertyRepository properties,
                                    SectorShapes shapes) {
        this.catalog = catalog;
        this.exposure = exposure;
        this.zones = zones;
        this.properties = properties;
        this.shapes = shapes;
    }

    /** Secteur d'un prestataire et logements de l'organisation qu'il couvre ou non. */
    @Transactional(readOnly = true)
    public Optional<SectorMapDto> forProvider(Long providerId, Long orgId, String hostSubject) {
        return visible(providerId, orgId).map(provider -> {
            var shape = shapes.provider(provider.getId(), provider.getDisplayName(),
                    catalog.avatarUrls(List.of(provider)).get(provider.getId()),
                    declared(provider,zones.effectiveZones(List.of(provider.getId())))).withUserId(provider.getUserId());
            return shapes.map(List.of(shape), properties(orgId, hostSubject, zones.coverageForProvider(provider.getId(), orgId)));
        });
    }

    /**
     * Secteur du prestataire relié au compte {@code userId} : celui qui intervient sur une
     * prestation, même s'il ne couvre aucun logement (il n'est alors pas dans {@link #relevantTo}).
     */
    @Transactional(readOnly = true)
    public Optional<SectorMapDto> forProviderUser(Long userId, Long orgId, String hostSubject) {
        return catalog.getProviderByUserId(userId).flatMap(provider -> forProvider(provider.getId(), orgId, hostSubject));
    }

    /** Prestataires visibles qui couvrent au moins un logement de l'organisation (ou de l'hôte). */
    @Transactional(readOnly = true)
    public SectorMapDto relevantTo(Long orgId, String hostSubject) {
        var mapProperties = mapProperties(orgId, hostSubject);
        var propertyIds = mapProperties.stream().map(PropertyRepository.SectorMapProperty::getId)
                .collect(Collectors.toSet());
        var coverage = zones.coverageForOrganization(orgId).stream()
                .filter(c -> propertyIds.contains(c.getPropertyId())).toList();

        Map<Long, Long> coveredCount = coverage.stream()
                .collect(Collectors.groupingBy(PropertyCoverage::getProviderId, Collectors.counting()));
        List<MarketplaceProvider> providers = coveredCount.entrySet().stream()
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed().thenComparing(Map.Entry::getKey))
                .map(entry -> visible(entry.getKey(), orgId))
                .flatMap(Optional::stream)
                .toList();
        var ids = providers.stream().map(MarketplaceProvider::getId).collect(Collectors.toSet());
        Map<Long, List<EffectiveZone>> zonesByProvider = ids.isEmpty() ? Map.of()
                : zones.effectiveZones(List.copyOf(ids)).stream().collect(Collectors.groupingBy(EffectiveZone::getProviderId));

        Map<Long, String> avatars = catalog.avatarUrls(providers);
        var shapesOf = providers.stream()
                .sorted(Comparator.comparing(MarketplaceProvider::getDisplayName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(p -> shapes.provider(p.getId(), p.getDisplayName(), avatars.get(p.getId()),
                        declared(p,zonesByProvider.getOrDefault(p.getId(), List.of()))).withUserId(p.getUserId()))
                .toList();
        var visibleCoverage = coverage.stream().filter(c -> ids.contains(c.getProviderId())).toList();
        return shapes.map(shapesOf, toDtos(mapProperties, visibleCoverage));
    }

    private Optional<MarketplaceProvider> visible(Long providerId, Long orgId) {
        return catalog.getProvider(providerId).filter(provider -> exposure.isVisibleTo(provider, orgId));
    }

    private List<PropertyRepository.SectorMapProperty> mapProperties(Long orgId, String hostSubject) {
        return hostSubject == null ? properties.findSectorMapProperties(orgId)
                : properties.findSectorMapPropertiesOfOwner(orgId, hostSubject);
    }

    private List<SectorMapDto.SectorProperty> properties(Long orgId, String hostSubject, List<PropertyCoverage> coverage) {
        return toDtos(mapProperties(orgId, hostSubject), coverage);
    }

    private static List<SectorMapDto.SectorProperty> toDtos(List<PropertyRepository.SectorMapProperty> mapProperties,
                                                            List<PropertyCoverage> coverage) {
        Map<Long, List<Long>> coveredBy = coverage.stream().collect(Collectors.groupingBy(
                PropertyCoverage::getPropertyId, LinkedHashMap::new,
                Collectors.mapping(PropertyCoverage::getProviderId, Collectors.toList())));
        return mapProperties.stream()
                .map(p -> new SectorMapDto.SectorProperty(p.getId(), p.getName(), p.getLatitude(), p.getLongitude(),
                        coveredBy.getOrDefault(p.getId(), List.of()).stream().sorted().toList()))
                .toList();
    }

    private static List<SectorShapes.DeclaredZone> declared(MarketplaceProvider provider,List<EffectiveZone> effective) {
        var declared=new java.util.ArrayList<>(effective.stream()
                .map(z -> new SectorShapes.DeclaredZone(z.getCountryCode(), z.getDepartment(), z.getArrondissement(), z.getCity()))
                .collect(Collectors.toMap(Function.identity(), Function.identity(), (a, b) -> a, LinkedHashMap::new))
                .values().stream().toList());
        if(provider.getTravelRadiusKm()!=null && provider.getLatitude()!=null && provider.getLongitude()!=null)
            declared.add(new SectorShapes.DeclaredZone(provider.getBaseCountryCode(),null,null,provider.getBaseCity(),
                provider.getLatitude().doubleValue(),provider.getLongitude().doubleValue(),provider.getTravelRadiusKm()));
        return declared;
    }
}
