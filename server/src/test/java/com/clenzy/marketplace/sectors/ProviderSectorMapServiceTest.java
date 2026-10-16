package com.clenzy.marketplace.sectors;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository.EffectiveZone;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository.PropertyCoverage;
import com.clenzy.marketplace.service.MarketplaceCatalogService;
import com.clenzy.marketplace.service.MarketplaceExposureService;
import com.clenzy.repository.PropertyRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProviderSectorMapServiceTest {

    private static final long ORG = 7L;
    private static SectorShapes shapes;

    private final MarketplaceCatalogService catalog = mock(MarketplaceCatalogService.class);
    private final MarketplaceExposureService exposure = mock(MarketplaceExposureService.class);
    private final MarketplaceProviderZoneRepository zones = mock(MarketplaceProviderZoneRepository.class);
    private final PropertyRepository properties = mock(PropertyRepository.class);
    private ProviderSectorMapService service;

    @BeforeAll
    static void loadShapes() {
        shapes = new SectorShapes(new SectorGeometryCatalog(new ObjectMapper()));
    }

    @BeforeEach
    void setUp() {
        service = new ProviderSectorMapService(catalog, exposure, zones, properties, shapes);
    }

    private MarketplaceProvider provider(long id, String name, boolean visible) {
        var provider = new MarketplaceProvider();
        provider.setId(id);
        provider.setDisplayName(name);
        when(catalog.getProvider(id)).thenReturn(Optional.of(provider));
        when(exposure.isVisibleTo(provider, ORG)).thenReturn(visible);
        return provider;
    }

    private static EffectiveZone zone(long providerId, String department) {
        EffectiveZone zone = mock(EffectiveZone.class);
        when(zone.getProviderId()).thenReturn(providerId);
        when(zone.getCountryCode()).thenReturn("FR");
        when(zone.getDepartment()).thenReturn(department);
        return zone;
    }

    private static PropertyCoverage covers(long providerId, long propertyId) {
        PropertyCoverage coverage = mock(PropertyCoverage.class);
        when(coverage.getProviderId()).thenReturn(providerId);
        when(coverage.getPropertyId()).thenReturn(propertyId);
        return coverage;
    }

    private static PropertyRepository.SectorMapProperty property(long id, String name) {
        PropertyRepository.SectorMapProperty property = mock(PropertyRepository.SectorMapProperty.class);
        when(property.getId()).thenReturn(id);
        when(property.getName()).thenReturn(name);
        when(property.getLatitude()).thenReturn(new BigDecimal("48.86"));
        when(property.getLongitude()).thenReturn(new BigDecimal("2.35"));
        return property;
    }

    @Test
    void whenTheProviderIsHiddenFromTheOrganization_thenNothingIsReturned() {
        provider(3L, "Masqué", false);

        assertThat(service.forProvider(3L, ORG, null)).isEmpty();
        verify(zones, never()).effectiveZones(anyList());
    }

    @Test
    void whenAProviderIsVisible_thenEachPropertyTellsWhetherItIsCovered() {
        provider(3L, "Clean Paris", true);
        List<EffectiveZone> declared = List.of(zone(3L, "75"));
        when(zones.effectiveZones(List.of(3L))).thenReturn(declared);
        List<PropertyCoverage> coverage = List.of(covers(3L, 10L));
        when(zones.coverageForProvider(3L, ORG)).thenReturn(coverage);
        List<PropertyRepository.SectorMapProperty> owned = List.of(property(10L, "Loft"), property(11L, "Villa"));
        when(properties.findSectorMapProperties(ORG)).thenReturn(owned);

        var map = service.forProvider(3L, ORG, null).orElseThrow();

        assertThat(map.providers()).singleElement().satisfies(p -> assertThat(p.geometry()).isNotNull());
        assertThat(map.properties()).extracting(SectorMapDto.SectorProperty::coveredBy)
                .containsExactly(List.of(3L), List.of());
    }

    @Test
    void whenTheProviderHasAPhoto_thenItsAvatarIsReturnedWithItsSector() {
        var provider = provider(3L, "Clean Paris", true);
        List<EffectiveZone> declared = List.of(zone(3L, "75"));
        when(zones.effectiveZones(List.of(3L))).thenReturn(declared);
        when(catalog.avatarUrls(List.of(provider))).thenReturn(Map.of(3L, "/api/public/avatars/9"));

        var map = service.forProvider(3L, ORG, null).orElseThrow();

        assertThat(map.providers()).singleElement()
                .satisfies(p -> assertThat(p.avatarUrl()).isEqualTo("/api/public/avatars/9"));
    }

    @Test
    void whenTheProviderHasAnAccount_thenItsUserIdIsReturnedToMatchItsMissions() {
        var provider = provider(3L, "Clean Paris", true);
        provider.setUserId(42L);
        List<EffectiveZone> declared = List.of(zone(3L, "75"));
        when(zones.effectiveZones(List.of(3L))).thenReturn(declared);

        var map = service.forProvider(3L, ORG, null).orElseThrow();

        assertThat(map.providers()).singleElement().satisfies(p -> assertThat(p.userId()).isEqualTo(42L));
    }

    @Test
    void whenAskedByAccount_thenTheLinkedProviderSectorIsReturnedEvenWithoutCoverage() {
        var provider = provider(3L, "Jean Martin", true);
        provider.setUserId(42L);
        when(catalog.getProviderByUserId(42L)).thenReturn(Optional.of(provider));
        when(catalog.getProviderByUserId(7L)).thenReturn(Optional.empty());

        var map = service.forProviderUser(42L, ORG, null).orElseThrow();

        assertThat(map.providers()).singleElement().satisfies(p -> {
            assertThat(p.providerId()).isEqualTo(3L);
            assertThat(p.userId()).isEqualTo(42L);
        });
        assertThat(service.forProviderUser(7L, ORG, null)).isEmpty();
    }

    @Test
    void whenAHostAsks_thenOnlyTheirOwnPropertiesAreShown() {
        provider(3L, "Clean Paris", true);
        when(zones.effectiveZones(List.of(3L))).thenReturn(List.of());
        when(zones.coverageForProvider(3L, ORG)).thenReturn(List.of());

        service.forProvider(3L, ORG, "host-subject");

        verify(properties).findSectorMapPropertiesOfOwner(ORG, "host-subject");
        verify(properties, never()).findSectorMapProperties(any());
    }

    @Test
    void whenListingRelevantProviders_thenHiddenOnesAndOtherHostsPropertiesAreLeftOut() {
        provider(3L, "Visible", true);
        provider(4L, "Masqué", false);
        List<PropertyRepository.SectorMapProperty> owned = List.of(property(10L, "Loft"));
        when(properties.findSectorMapPropertiesOfOwner(ORG, "host")).thenReturn(owned);
        // 11 appartient à un autre hôte de l'organisation : sa couverture ne doit pas fuiter.
        List<PropertyCoverage> coverage = List.of(covers(3L, 10L), covers(4L, 10L), covers(5L, 11L));
        when(zones.coverageForOrganization(ORG)).thenReturn(coverage);
        List<EffectiveZone> declared = List.of(zone(3L, "75"));
        when(zones.effectiveZones(eq(List.of(3L)))).thenReturn(declared);

        var map = service.relevantTo(ORG, "host");

        assertThat(map.providers()).extracting(SectorMapDto.ProviderSectors::providerId).containsExactly(3L);
        assertThat(map.properties()).singleElement()
                .satisfies(p -> assertThat(p.coveredBy()).containsExactly(3L));
        verify(catalog, never()).getProvider(5L);
    }

    @Test void salmaIsListedWithOnlyHerThreeArrondissementOutlinesAndRemovingOneUpdatesTheOutline() {
        provider(27L,"Salma Chraibi",true);
        var owned=List.of(property(75L,"Loft Bastille"),property(76L,"Studio Jemmapes"));
        var coverage=List.of(covers(27L,76L));
        when(properties.findSectorMapProperties(ORG)).thenReturn(owned);
        when(zones.coverageForOrganization(ORG)).thenReturn(coverage);
        var third=zone(27L,"75");when(third.getArrondissement()).thenReturn("3e");
        var tenth=zone(27L,"75");when(tenth.getArrondissement()).thenReturn("75110");
        var eighteenth=zone(27L,"75");when(eighteenth.getArrondissement()).thenReturn("75018");
        when(zones.effectiveZones(List.of(27L))).thenReturn(List.of(third,tenth,eighteenth),List.of(third,tenth));

        var map=service.relevantTo(ORG,null);
        assertThat(map.providers()).singleElement().satisfies(p -> {
            assertThat(p.name()).isEqualTo("Salma Chraibi");
            assertThat(p.zones()).extracting(SectorMapDto.Zone::key).containsExactly("FR-A-75103","FR-A-75110","FR-A-75118");
        });
        assertThat(map.properties()).extracting(SectorMapDto.SectorProperty::coveredBy).containsExactly(List.of(),List.of(27L));
        var catalogOf=new SectorGeometryCatalog(new ObjectMapper());
        var geometry=GeoJsonGeometries.read(new ObjectMapper().valueToTree(map.providers().getFirst().geometry()),catalogOf.factory());
        var tenthPoint=catalogOf.find("FR","75","75110",null).orElseThrow().geometry().getInteriorPoint();
        var eleventhPoint=catalogOf.find("FR","75","75111",null).orElseThrow().geometry().getInteriorPoint();
        var eighteenthPoint=catalogOf.find("FR","75","75118",null).orElseThrow().geometry().getInteriorPoint();
        assertThat(geometry.covers(tenthPoint)).isTrue();assertThat(geometry.covers(eighteenthPoint)).isTrue();
        assertThat(geometry.covers(eleventhPoint)).isFalse();
        assertThat(geometry.getArea()).isLessThan(catalogOf.find("FR","75",null,null).orElseThrow().geometry().getArea());

        var changed=service.relevantTo(ORG,null);
        var updated=GeoJsonGeometries.read(new ObjectMapper().valueToTree(changed.providers().getFirst().geometry()),catalogOf.factory());
        assertThat(updated.covers(tenthPoint)).isTrue();assertThat(updated.covers(eighteenthPoint)).isFalse();
        assertThat(updated.getArea()).isLessThan(geometry.getArea());
    }

    @Test void salmaAtRankFiftyThreeIsNotDroppedBeforeTheBrowserFiltersToParis() {
        var owned=List.of(property(75L,"Loft Bastille"),property(76L,"Studio Jemmapes"));
        when(properties.findSectorMapProperties(ORG)).thenReturn(owned);
        var coverage=new java.util.ArrayList<PropertyCoverage>();
        var declared=new java.util.ArrayList<EffectiveZone>();
        for(long id=100;id<152;id++) {
            provider(id,"Prestataire "+id,true);
            coverage.add(covers(id,75L));coverage.add(covers(id,76L));
            declared.add(zone(id,"75"));
        }
        provider(27L,"Salma Chraibi",true);
        coverage.add(covers(27L,76L));
        for(String code:List.of("75103","75110","75118")) {
            var sector=zone(27L,"75");when(sector.getArrondissement()).thenReturn(code);declared.add(sector);
        }
        when(zones.coverageForOrganization(ORG)).thenReturn(coverage);
        when(zones.effectiveZones(anyList())).thenReturn(declared);

        var map=service.relevantTo(ORG,null);

        assertThat(map.providers()).hasSize(53);
        assertThat(map.providers().stream().filter(p->Long.valueOf(27).equals(p.providerId())))
            .singleElement().satisfies(p->{
                assertThat(p.name()).isEqualTo("Salma Chraibi");
                assertThat(p.geometry()).isNotNull();
                assertThat(p.zones()).extracting(SectorMapDto.Zone::key)
                    .containsExactly("FR-A-75103","FR-A-75110","FR-A-75118");
            });
        assertThat(map.properties().stream().filter(p->p.id()==76L).findFirst().orElseThrow().coveredBy()).contains(27L);
        assertThat(map.properties().stream().filter(p->p.id()==75L).findFirst().orElseThrow().coveredBy()).doesNotContain(27L);
    }
}
