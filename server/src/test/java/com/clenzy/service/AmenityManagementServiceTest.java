package com.clenzy.service;

import com.clenzy.dto.amenity.AmenityAliasDto;
import com.clenzy.dto.amenity.CreateAliasRequest;
import com.clenzy.dto.amenity.CreateCustomAmenityRequest;
import com.clenzy.dto.amenity.CreateIgnoredRequest;
import com.clenzy.dto.amenity.CustomAmenityDto;
import com.clenzy.dto.amenity.IgnoredAmenityDto;
import com.clenzy.dto.amenity.ReprocessResult;
import com.clenzy.dto.amenity.UnmappedAmenityDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexFacilityOptionDto;
import com.clenzy.model.AmenityAlias;
import com.clenzy.model.CustomAmenity;
import com.clenzy.model.IgnoredAmenity;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.AmenityAliasRepository;
import com.clenzy.repository.CustomAmenityRepository;
import com.clenzy.repository.IgnoredAmenityRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AmenityManagementServiceTest {

    @Mock private CustomAmenityRepository customAmenityRepository;
    @Mock private AmenityAliasRepository aliasRepository;
    @Mock private IgnoredAmenityRepository ignoredRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private ChannexClient channexClient;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private AmenityManagementService service;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        service = new AmenityManagementService(customAmenityRepository, aliasRepository,
                ignoredRepository, propertyRepository, userRepository, objectMapper, channexClient);
    }

    private Property property(Long id, String name, String rawAmenities, String amenities) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        p.setOtaRawAmenities(rawAmenities);
        p.setAmenities(amenities);
        p.setOrganizationId(ORG_ID);
        return p;
    }

    private AmenityAlias alias(Long id, String raw, String code) {
        AmenityAlias a = new AmenityAlias();
        a.setId(id);
        a.setOrganizationId(ORG_ID);
        a.setRawOtaName(raw);
        a.setClenzyCode(code);
        return a;
    }

    private IgnoredAmenity ignored(Long id, String raw) {
        IgnoredAmenity i = new IgnoredAmenity();
        i.setId(id);
        i.setOrganizationId(ORG_ID);
        i.setRawOtaName(raw);
        return i;
    }

    private CustomAmenity custom(Long id, String code, String labelFr) {
        CustomAmenity c = new CustomAmenity();
        c.setId(id);
        c.setOrganizationId(ORG_ID);
        c.setCode(code);
        c.setLabelFr(labelFr);
        return c;
    }

    // ── Channex catalog ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("listChannexFacilityCatalog")
    class ChannexCatalogTests {

        @Test
        void returnsFreshCatalogFromClient() {
            ChannexFacilityOptionDto wifi = new ChannexFacilityOptionDto("1", "Wi-Fi", "internet");
            when(channexClient.fetchPropertyFacilityCatalog()).thenReturn(List.of(wifi));

            List<ChannexFacilityOptionDto> result = service.listChannexFacilityCatalog();

            assertThat(result).containsExactly(wifi);
        }

        @Test
        void cachesResultAcrossCalls() {
            ChannexFacilityOptionDto wifi = new ChannexFacilityOptionDto("1", "Wi-Fi", "internet");
            when(channexClient.fetchPropertyFacilityCatalog()).thenReturn(List.of(wifi));

            service.listChannexFacilityCatalog();
            service.listChannexFacilityCatalog();

            // Cache => only one upstream call
            verify(channexClient, times(1)).fetchPropertyFacilityCatalog();
        }

        @Test
        void returnsEmptyWhenClientReturnsNull() {
            when(channexClient.fetchPropertyFacilityCatalog()).thenReturn(null);

            assertThat(service.listChannexFacilityCatalog()).isEmpty();
        }

        @Test
        void returnsEmptyWhenClientThrows() {
            when(channexClient.fetchPropertyFacilityCatalog()).thenThrow(new RuntimeException("Channex down"));

            assertThat(service.listChannexFacilityCatalog()).isEmpty();
        }

        @Test
        void emptyResultIsNotCached() {
            when(channexClient.fetchPropertyFacilityCatalog()).thenReturn(List.of());

            service.listChannexFacilityCatalog();
            service.listChannexFacilityCatalog();

            // Empty response => no cache => 2 calls
            verify(channexClient, times(2)).fetchPropertyFacilityCatalog();
        }
    }

    // ── findUnmapped ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("findUnmapped")
    class FindUnmappedTests {

        @Test
        void aggregatesByRawName_sortedByCountDesc() throws Exception {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());

            Property p1 = property(10L, "Loft", objectMapper.writeValueAsString(List.of("Wi-Fi", "Pool")), null);
            Property p2 = property(11L, "Studio", objectMapper.writeValueAsString(List.of("Wi-Fi")), null);

            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of(p1, p2));

            List<UnmappedAmenityDto> result = service.findUnmapped(ORG_ID);

            assertThat(result).hasSize(2);
            assertThat(result.get(0).rawOtaName()).isEqualTo("Wi-Fi");
            assertThat(result.get(0).occurrences()).isEqualTo(2);
            assertThat(result.get(1).rawOtaName()).isEqualTo("Pool");
            assertThat(result.get(1).occurrences()).isEqualTo(1);
        }

        @Test
        void excludesAliasedRaws() throws Exception {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(alias(1L, "Wi-Fi", "WIFI")));
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());

            Property p = property(10L, "Loft", objectMapper.writeValueAsString(List.of("Wi-Fi", "Pool")), null);
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of(p));

            List<UnmappedAmenityDto> result = service.findUnmapped(ORG_ID);

            assertThat(result).extracting(UnmappedAmenityDto::rawOtaName).containsOnly("Pool");
        }

        @Test
        void excludesIgnoredRaws() throws Exception {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(ignored(1L, "Pool")));

            Property p = property(10L, "Loft", objectMapper.writeValueAsString(List.of("Wi-Fi", "Pool")), null);
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of(p));

            List<UnmappedAmenityDto> result = service.findUnmapped(ORG_ID);

            assertThat(result).extracting(UnmappedAmenityDto::rawOtaName).containsOnly("Wi-Fi");
        }

        @Test
        void returnsEmptyWhenNoProperties() {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of());

            assertThat(service.findUnmapped(ORG_ID)).isEmpty();
        }

        @Test
        void limitsAffectedPropertiesPreviewToFive() throws Exception {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());

            String rawJson = objectMapper.writeValueAsString(List.of("Wi-Fi"));
            List<Property> many = List.of(
                    property(1L, "A", rawJson, null),
                    property(2L, "B", rawJson, null),
                    property(3L, "C", rawJson, null),
                    property(4L, "D", rawJson, null),
                    property(5L, "E", rawJson, null),
                    property(6L, "F", rawJson, null),
                    property(7L, "G", rawJson, null)
            );
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(many);

            List<UnmappedAmenityDto> result = service.findUnmapped(ORG_ID);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).affectedProperties()).hasSize(5);
            assertThat(result.get(0).occurrences()).isEqualTo(7);
        }

        @Test
        void invalidJsonGracefullyDegrades() {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());

            Property p = property(10L, "Loft", "not-json", null);
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of(p));

            assertThat(service.findUnmapped(ORG_ID)).isEmpty();
        }
    }

    // ── Custom amenities CRUD ──────────────────────────────────────────────

    @Nested
    @DisplayName("CustomAmenity CRUD")
    class CustomAmenityTests {

        @Test
        void list_returnsDtos() {
            CustomAmenity c = custom(1L, "WIFI", "Wi-Fi");
            when(customAmenityRepository.findByOrganizationIdOrderByLabelFrAsc(ORG_ID)).thenReturn(List.of(c));

            List<CustomAmenityDto> result = service.listCustomAmenities(ORG_ID);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).code()).isEqualTo("WIFI");
            assertThat(result.get(0).labelFr()).isEqualTo("Wi-Fi");
        }

        @Test
        void create_generatesCodeFromLabelFrWhenAbsent() {
            when(customAmenityRepository.existsByOrganizationIdAndCode(ORG_ID, "DETECTEUR_DE_FUMEE")).thenReturn(false);
            when(customAmenityRepository.save(any(CustomAmenity.class))).thenAnswer(inv -> {
                CustomAmenity c = inv.getArgument(0);
                c.setId(42L);
                return c;
            });

            CreateCustomAmenityRequest req = new CreateCustomAmenityRequest(
                    "Détecteur de fumée", null, null, null, null, false);

            CustomAmenityDto dto = service.createCustomAmenity(ORG_ID, null, req);

            assertThat(dto.code()).isEqualTo("DETECTEUR_DE_FUMEE");
            assertThat(dto.labelFr()).isEqualTo("Détecteur de fumée");
        }

        @Test
        void create_usesProvidedCode_uppercased() {
            when(customAmenityRepository.existsByOrganizationIdAndCode(ORG_ID, "EV_CHARGER")).thenReturn(false);
            when(customAmenityRepository.save(any(CustomAmenity.class))).thenAnswer(inv -> {
                CustomAmenity c = inv.getArgument(0);
                c.setId(43L);
                return c;
            });

            CreateCustomAmenityRequest req = new CreateCustomAmenityRequest(
                    "EV charger", null, "comfort", "ev_charger", null, false);

            CustomAmenityDto dto = service.createCustomAmenity(ORG_ID, null, req);

            assertThat(dto.code()).isEqualTo("EV_CHARGER");
            assertThat(dto.category()).isEqualTo("comfort");
        }

        @Test
        void create_defaultCategoryIsCustom() {
            when(customAmenityRepository.existsByOrganizationIdAndCode(ORG_ID, "WIFI")).thenReturn(false);
            when(customAmenityRepository.save(any(CustomAmenity.class))).thenAnswer(inv -> {
                CustomAmenity c = inv.getArgument(0);
                c.setId(44L);
                return c;
            });

            CreateCustomAmenityRequest req = new CreateCustomAmenityRequest(
                    "Wi-Fi", null, null, "WIFI", null, false);

            CustomAmenityDto dto = service.createCustomAmenity(ORG_ID, null, req);

            assertThat(dto.category()).isEqualTo("custom");
        }

        @Test
        void create_rejectsDuplicateCode() {
            when(customAmenityRepository.existsByOrganizationIdAndCode(ORG_ID, "WIFI")).thenReturn(true);

            CreateCustomAmenityRequest req = new CreateCustomAmenityRequest(
                    "Wi-Fi", null, null, "wifi", null, false);

            assertThatThrownBy(() -> service.createCustomAmenity(ORG_ID, null, req))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("existe deja");
        }

        @Test
        void create_attachesCreatedByWhenKeycloakIdProvided() {
            when(customAmenityRepository.existsByOrganizationIdAndCode(ORG_ID, "WIFI")).thenReturn(false);
            User u = new User();
            u.setId(7L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(u));
            when(customAmenityRepository.save(any(CustomAmenity.class))).thenAnswer(inv -> {
                CustomAmenity c = inv.getArgument(0);
                c.setId(45L);
                return c;
            });

            service.createCustomAmenity(ORG_ID, "kc-1",
                    new CreateCustomAmenityRequest("Wi-Fi", null, null, "WIFI", null, false));

            ArgumentCaptor<CustomAmenity> captor = ArgumentCaptor.forClass(CustomAmenity.class);
            verify(customAmenityRepository).save(captor.capture());
            assertThat(captor.getValue().getCreatedBy()).isSameAs(u);
        }

        @Test
        void create_alsoCreatesAliasWhenRequested() {
            when(customAmenityRepository.existsByOrganizationIdAndCode(ORG_ID, "SMOKE_ALARM")).thenReturn(false);
            when(customAmenityRepository.save(any(CustomAmenity.class))).thenAnswer(inv -> {
                CustomAmenity c = inv.getArgument(0);
                c.setId(46L);
                return c;
            });
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Smoke alarm")).thenReturn(false);
            when(aliasRepository.save(any(AmenityAlias.class))).thenAnswer(inv -> {
                AmenityAlias a = inv.getArgument(0);
                a.setId(99L);
                return a;
            });

            service.createCustomAmenity(ORG_ID, null,
                    new CreateCustomAmenityRequest("Smoke alarm", null, null, "SMOKE_ALARM",
                            "Smoke alarm", false));

            verify(aliasRepository).save(any(AmenityAlias.class));
        }

        @Test
        void create_aliasFailureDoesNotPropagate() {
            when(customAmenityRepository.existsByOrganizationIdAndCode(ORG_ID, "SMOKE_ALARM")).thenReturn(false);
            when(customAmenityRepository.save(any(CustomAmenity.class))).thenAnswer(inv -> {
                CustomAmenity c = inv.getArgument(0);
                c.setId(46L);
                return c;
            });
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Smoke alarm")).thenReturn(true);

            CustomAmenityDto dto = service.createCustomAmenity(ORG_ID, null,
                    new CreateCustomAmenityRequest("Smoke alarm", null, null, "SMOKE_ALARM",
                            "Smoke alarm", false));

            assertThat(dto.code()).isEqualTo("SMOKE_ALARM");
        }

        @Test
        void delete_success_cascadesAliases() {
            CustomAmenity c = custom(1L, "WIFI", "Wi-Fi");
            when(customAmenityRepository.findById(1L)).thenReturn(Optional.of(c));
            when(aliasRepository.findByOrganizationIdAndClenzyCode(ORG_ID, "WIFI"))
                    .thenReturn(List.of(alias(10L, "Internet", "WIFI")));

            service.deleteCustomAmenity(ORG_ID, 1L);

            verify(aliasRepository).deleteAll(any());
            verify(customAmenityRepository).delete(c);
        }

        @Test
        void delete_notFound_throws() {
            when(customAmenityRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteCustomAmenity(ORG_ID, 99L))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void delete_otherOrg_throwsSecurity() {
            CustomAmenity c = custom(1L, "WIFI", "Wi-Fi");
            c.setOrganizationId(999L);
            when(customAmenityRepository.findById(1L)).thenReturn(Optional.of(c));

            assertThatThrownBy(() -> service.deleteCustomAmenity(ORG_ID, 1L))
                    .isInstanceOf(SecurityException.class);
        }
    }

    // ── Aliases CRUD ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Alias CRUD")
    class AliasTests {

        @Test
        void list_returnsDtos() {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(alias(1L, "Wi-Fi", "WIFI")));

            List<AmenityAliasDto> result = service.listAliases(ORG_ID);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).rawOtaName()).isEqualTo("Wi-Fi");
            assertThat(result.get(0).clenzyCode()).isEqualTo("WIFI");
        }

        @Test
        void create_success() {
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Wi-Fi")).thenReturn(false);
            when(aliasRepository.save(any(AmenityAlias.class))).thenAnswer(inv -> {
                AmenityAlias a = inv.getArgument(0);
                a.setId(50L);
                return a;
            });

            CreateAliasRequest req = new CreateAliasRequest("Wi-Fi", "wifi", null, false);
            AmenityAliasDto dto = service.createAlias(ORG_ID, null, req);

            assertThat(dto.clenzyCode()).isEqualTo("WIFI");
        }

        @Test
        void create_rejectsDuplicate() {
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Wi-Fi")).thenReturn(true);

            assertThatThrownBy(() -> service.createAlias(ORG_ID, null,
                    new CreateAliasRequest("Wi-Fi", "WIFI", null, false)))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void create_appliesToPropertiesTriggersReprocess() {
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Wi-Fi")).thenReturn(false);
            when(aliasRepository.save(any(AmenityAlias.class))).thenAnswer(inv -> {
                AmenityAlias a = inv.getArgument(0);
                a.setId(50L);
                return a;
            });
            // reprocess deps
            lenient().when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            lenient().when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of());

            service.createAlias(ORG_ID, null, new CreateAliasRequest("Wi-Fi", "WIFI", null, true));

            verify(propertyRepository).findByOrgWithRawAmenities(ORG_ID);
        }

        @Test
        void create_attachesCreatedBy() {
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Wi-Fi")).thenReturn(false);
            User u = new User();
            u.setId(7L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(u));
            when(aliasRepository.save(any(AmenityAlias.class))).thenAnswer(inv -> {
                AmenityAlias a = inv.getArgument(0);
                a.setId(50L);
                return a;
            });

            service.createAlias(ORG_ID, "kc-1", new CreateAliasRequest("Wi-Fi", "WIFI", "AirBNB", false));

            ArgumentCaptor<AmenityAlias> captor = ArgumentCaptor.forClass(AmenityAlias.class);
            verify(aliasRepository).save(captor.capture());
            assertThat(captor.getValue().getCreatedBy()).isSameAs(u);
            assertThat(captor.getValue().getOtaSource()).isEqualTo("AirBNB");
        }

        @Test
        void bulkCreate_savesEachNew() {
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Wi-Fi")).thenReturn(false);
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Internet")).thenReturn(false);
            when(aliasRepository.save(any(AmenityAlias.class))).thenAnswer(inv -> inv.getArgument(0));

            // Use Arrays.asList so null/blank elements are allowed and exercised by the loop
            CreateAliasRequest.BulkRequest req = new CreateAliasRequest.BulkRequest(
                    "WIFI", java.util.Arrays.asList("Wi-Fi", "Internet", "", null), null, false);

            ReprocessResult result = service.bulkCreateAliases(ORG_ID, null, req);

            assertThat(result.propertiesScanned()).isZero();
            verify(aliasRepository, times(2)).save(any(AmenityAlias.class));
        }

        @Test
        void bulkCreate_skipsExisting() {
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Wi-Fi")).thenReturn(true);
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Internet")).thenReturn(false);
            when(aliasRepository.save(any(AmenityAlias.class))).thenAnswer(inv -> inv.getArgument(0));

            CreateAliasRequest.BulkRequest req = new CreateAliasRequest.BulkRequest(
                    "WIFI", List.of("Wi-Fi", "Internet"), null, false);

            service.bulkCreateAliases(ORG_ID, null, req);

            verify(aliasRepository, times(1)).save(any(AmenityAlias.class));
        }

        @Test
        void bulkCreate_appliesToPropertiesReturnsRealReprocess() {
            when(aliasRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Wi-Fi")).thenReturn(false);
            when(aliasRepository.save(any(AmenityAlias.class))).thenAnswer(inv -> inv.getArgument(0));
            // reprocess phase
            lenient().when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            lenient().when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of());

            ReprocessResult result = service.bulkCreateAliases(ORG_ID, null,
                    new CreateAliasRequest.BulkRequest("WIFI", List.of("Wi-Fi"), null, true));

            assertThat(result.propertiesScanned()).isZero();
            verify(propertyRepository).findByOrgWithRawAmenities(ORG_ID);
        }

        @Test
        void delete_success() {
            AmenityAlias a = alias(1L, "Wi-Fi", "WIFI");
            when(aliasRepository.findById(1L)).thenReturn(Optional.of(a));

            service.deleteAlias(ORG_ID, 1L);

            verify(aliasRepository).delete(a);
        }

        @Test
        void delete_notFound_throws() {
            when(aliasRepository.findById(99L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.deleteAlias(ORG_ID, 99L))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void delete_otherOrg_throwsSecurity() {
            AmenityAlias a = alias(1L, "Wi-Fi", "WIFI");
            a.setOrganizationId(999L);
            when(aliasRepository.findById(1L)).thenReturn(Optional.of(a));

            assertThatThrownBy(() -> service.deleteAlias(ORG_ID, 1L))
                    .isInstanceOf(SecurityException.class);
        }
    }

    // ── Ignored CRUD ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Ignored CRUD")
    class IgnoredTests {

        @Test
        void list_returnsDtos() {
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(ignored(1L, "Long term stays")));

            List<IgnoredAmenityDto> result = service.listIgnored(ORG_ID);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).rawOtaName()).isEqualTo("Long term stays");
        }

        @Test
        void create_success() {
            when(ignoredRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Long term stays")).thenReturn(false);
            when(ignoredRepository.save(any(IgnoredAmenity.class))).thenAnswer(inv -> {
                IgnoredAmenity i = inv.getArgument(0);
                i.setId(60L);
                return i;
            });

            IgnoredAmenityDto dto = service.createIgnored(ORG_ID, null,
                    new CreateIgnoredRequest("Long term stays", null, false));

            assertThat(dto.rawOtaName()).isEqualTo("Long term stays");
        }

        @Test
        void create_rejectsDuplicate() {
            when(ignoredRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Long term stays")).thenReturn(true);

            assertThatThrownBy(() -> service.createIgnored(ORG_ID, null,
                    new CreateIgnoredRequest("Long term stays", null, false)))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void create_appliesToPropertiesTriggersReprocess() {
            when(ignoredRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Foo")).thenReturn(false);
            when(ignoredRepository.save(any(IgnoredAmenity.class))).thenAnswer(inv -> {
                IgnoredAmenity i = inv.getArgument(0);
                i.setId(60L);
                return i;
            });
            lenient().when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            lenient().when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of());

            service.createIgnored(ORG_ID, null, new CreateIgnoredRequest("Foo", null, true));

            verify(propertyRepository).findByOrgWithRawAmenities(ORG_ID);
        }

        @Test
        void create_attachesCreatedBy() {
            when(ignoredRepository.existsByOrganizationIdAndRawOtaName(ORG_ID, "Foo")).thenReturn(false);
            User u = new User();
            u.setId(7L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(u));
            when(ignoredRepository.save(any(IgnoredAmenity.class))).thenAnswer(inv -> {
                IgnoredAmenity i = inv.getArgument(0);
                i.setId(60L);
                return i;
            });

            service.createIgnored(ORG_ID, "kc-1", new CreateIgnoredRequest("Foo", "AirBNB", false));

            ArgumentCaptor<IgnoredAmenity> captor = ArgumentCaptor.forClass(IgnoredAmenity.class);
            verify(ignoredRepository).save(captor.capture());
            assertThat(captor.getValue().getCreatedBy()).isSameAs(u);
            assertThat(captor.getValue().getOtaSource()).isEqualTo("AirBNB");
        }

        @Test
        void delete_success() {
            IgnoredAmenity i = ignored(1L, "Foo");
            when(ignoredRepository.findById(1L)).thenReturn(Optional.of(i));

            service.deleteIgnored(ORG_ID, 1L);

            verify(ignoredRepository).delete(i);
        }

        @Test
        void delete_notFound_throws() {
            when(ignoredRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteIgnored(ORG_ID, 99L))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void delete_otherOrg_throwsSecurity() {
            IgnoredAmenity i = ignored(1L, "Foo");
            i.setOrganizationId(999L);
            when(ignoredRepository.findById(1L)).thenReturn(Optional.of(i));

            assertThatThrownBy(() -> service.deleteIgnored(ORG_ID, 1L))
                    .isInstanceOf(SecurityException.class);
        }
    }

    // ── reprocess ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("reprocess")
    class ReprocessTests {

        @Test
        void appliesAliasesAndUpdatesProperty() throws Exception {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(alias(1L, "Wi-Fi", "WIFI")));
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());

            Property p = property(10L, "Loft",
                    objectMapper.writeValueAsString(List.of("Wi-Fi", "Pool")), null);
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of(p));

            ReprocessResult result = service.reprocess(ORG_ID);

            assertThat(result.propertiesScanned()).isEqualTo(1);
            assertThat(result.propertiesUpdated()).isEqualTo(1);
            assertThat(result.totalMappedAdded()).isEqualTo(1);
            assertThat(result.totalLeftUnmapped()).isEqualTo(1);
            verify(propertyRepository).save(p);
        }

        @Test
        void removesIgnoredFromRaw() throws Exception {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(ignored(1L, "Pool")));

            Property p = property(10L, "Loft",
                    objectMapper.writeValueAsString(List.of("Wi-Fi", "Pool")), null);
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of(p));

            ReprocessResult result = service.reprocess(ORG_ID);

            assertThat(result.totalIgnoredRemoved()).isEqualTo(1);
            assertThat(result.propertiesUpdated()).isEqualTo(1);
        }

        @Test
        void preservesExistingAmenities() throws Exception {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(alias(1L, "Wi-Fi", "WIFI")));
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());

            Property p = property(10L, "Loft",
                    objectMapper.writeValueAsString(List.of("Wi-Fi")),
                    objectMapper.writeValueAsString(List.of("TV")));
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of(p));

            service.reprocess(ORG_ID);

            ArgumentCaptor<Property> captor = ArgumentCaptor.forClass(Property.class);
            verify(propertyRepository).save(captor.capture());
            assertThat(captor.getValue().getAmenities()).contains("TV").contains("WIFI");
        }

        @Test
        void noChange_doesNotSave() throws Exception {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());

            Property p = property(10L, "Loft",
                    objectMapper.writeValueAsString(List.of("Unknown")), null);
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of(p));

            ReprocessResult result = service.reprocess(ORG_ID);

            assertThat(result.propertiesScanned()).isEqualTo(1);
            assertThat(result.propertiesUpdated()).isZero();
            verify(propertyRepository, never()).save(any());
        }

        @Test
        void caseInsensitiveMatching() throws Exception {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(alias(1L, "wi-fi", "WIFI")));
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());

            Property p = property(10L, "Loft",
                    objectMapper.writeValueAsString(List.of("Wi-Fi")), null);
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of(p));

            ReprocessResult result = service.reprocess(ORG_ID);

            assertThat(result.totalMappedAdded()).isEqualTo(1);
        }

        @Test
        void emptyProperties_returnsZeros() {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID)).thenReturn(List.of());
            when(propertyRepository.findByOrgWithRawAmenities(ORG_ID)).thenReturn(List.of());

            ReprocessResult result = service.reprocess(ORG_ID);

            assertThat(result.propertiesScanned()).isZero();
            assertThat(result.propertiesUpdated()).isZero();
        }
    }

    // ── Public lookups ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("loadAliasesByOrg / loadIgnoredByOrg")
    class PublicLookupsTests {

        @Test
        void loadAliases_buildsLowercaseKeyedMap() {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(alias(1L, "Wi-Fi", "WIFI"), alias(2L, "Pool", "POOL")));

            Map<String, String> result = service.loadAliasesByOrg(ORG_ID);

            assertThat(result).containsEntry("wi-fi", "WIFI").containsEntry("pool", "POOL");
        }

        @Test
        void loadAliases_duplicateKeysKeepFirst() {
            when(aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(alias(1L, "Wi-Fi", "WIFI"), alias(2L, "wi-fi", "INTERNET")));

            Map<String, String> result = service.loadAliasesByOrg(ORG_ID);

            assertThat(result).containsEntry("wi-fi", "WIFI"); // first wins
        }

        @Test
        void loadIgnored_setLowercase() {
            when(ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(ORG_ID))
                    .thenReturn(List.of(ignored(1L, "Long Term Stays")));

            assertThat(service.loadIgnoredByOrg(ORG_ID)).containsOnly("long term stays");
        }
    }
}
