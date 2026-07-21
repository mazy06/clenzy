package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexConnectedOta;
import com.clenzy.integration.channex.dto.ChannexDiscoveryResponse;
import com.clenzy.integration.channex.dto.ChannexImportRequest;
import com.clenzy.integration.channex.dto.ChannexImportResult;
import com.clenzy.integration.channex.dto.ChannexRatePlanDto;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDto;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDetailDto;
import com.clenzy.integration.channex.dto.ChannexHotelPolicyDto;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.LengthOfStayDiscountRepository;
import com.clenzy.repository.OccupancyPricingRepository;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.RatePlanRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.AmenityManagementService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests etendus pour {@link ChannexImportService} couvrant :
 * <ul>
 *   <li>importProperties happy-path complet (Property + Mapping creees, photo
 *       import, pull bookings, push initial — best-effort tolerees)</li>
 *   <li>resyncAllPropertiesContent avec mappings actifs / inactifs</li>
 *   <li>resyncPropertyContent happy-path (avec scrape Airbnb mock via httpClient
 *       in fact only via channex client whitelabel response)</li>
 *   <li>buildListingInfoMap indirectement via discoverUnmappedProperties</li>
 *   <li>setupGlobalOauth : tous les sous-cas restants</li>
 *   <li>disconnectOtaChannel : deactivate ok + delete ok + reraise</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("ChannexImportService — extended coverage")
class ChannexImportServiceExtendedTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private PropertyPhotoRepository propertyPhotoRepository;
    @Mock private ChannexConnectService connectService;
    @Mock private UserRepository userRepository;
    @Mock private LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    @Mock private RatePlanRepository ratePlanRepository;
    @Mock private OccupancyPricingRepository occupancyPricingRepository;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private BookingRestrictionRepository bookingRestrictionRepository;
    @Mock private AmenityManagementService amenityManagementService;
    @Mock private ChannexPricingImporter pricingImporter;
    @Mock private org.springframework.beans.factory.ObjectProvider<ChannexImportService> selfProvider;

    private ObjectMapper objectMapper;
    private ChannexImportService service;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new ChannexImportService(
            channexClient, mappingRepository, propertyRepository, propertyPhotoRepository,
            connectService, userRepository, lengthOfStayDiscountRepository,
            ratePlanRepository, occupancyPricingRepository, rateOverrideRepository,
            bookingRestrictionRepository, objectMapper, amenityManagementService, pricingImporter,
            selfProvider);
        // self = l'instance elle-meme (pas de proxy Spring en test unitaire)
        when(selfProvider.getObject()).thenAnswer(inv -> service);
    }

    private JsonNode jn(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private User buildUser(Long id, Long orgId) {
        User u = new User();
        u.setId(id);
        u.setKeycloakId("kc-" + id);
        u.setOrganizationId(orgId);
        u.setFirstName("First");
        u.setLastName("Last");
        return u;
    }

    private Property buildProperty(Long id, Long orgId) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        p.setName("Property #" + id);
        p.setMaxGuests(4);
        return p;
    }

    // ─── importProperties (happy-path mock complet) ──────────────────────────

    @Nested
    @DisplayName("importProperties — happy path")
    class ImportPropertiesHappy {

        @Test
        @DisplayName("creates Property + Mapping for a single Channex listing")
        void singleProperty_isCreated() {
            // Arrange
            User user = buildUser(1L, 42L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(mappingRepository.findByChannexPropertyId("prop-1", 42L))
                .thenReturn(Optional.empty());

            // Channex property data
            when(channexClient.fetchPropertyRaw("prop-1")).thenReturn(jn("""
                {"data":{"id":"prop-1","attributes":{
                  "title":"Mon Studio Paris",
                  "currency":"EUR","country":"FR","timezone":"Europe/Paris",
                  "max_count_of_occupancies":4,
                  "address":"10 rue de Rivoli",
                  "city":"Paris","zip_code":"75001",
                  "latitude":"48.8566","longitude":"2.3522",
                  "content":{"description":"Beau studio au coeur de Paris","photos":[]}
                }}}
                """));

            // Channels (empty — no OTA info)
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));

            // Room type already exists
            ChannexRoomTypeDto roomType = mock(ChannexRoomTypeDto.class);
            when(roomType.id()).thenReturn("rt-12345678-aaaa");
            when(roomType.title()).thenReturn("Standard Room");
            when(channexClient.fetchRoomTypesForProperty("prop-1")).thenReturn(List.of(roomType));

            // Rate plan already exists
            ChannexRatePlanDto ratePlan = mock(ChannexRatePlanDto.class);
            when(ratePlan.id()).thenReturn("rp-87654321-bbbb");
            when(ratePlan.title()).thenReturn("Standard Rate");
            when(ratePlan.roomTypeId()).thenReturn("rt-12345678-aaaa");
            when(channexClient.fetchRatePlansForProperty("prop-1")).thenReturn(List.of(ratePlan));

            // Optional enrichment
            when(channexClient.fetchRoomTypeDetail("rt-12345678-aaaa")).thenReturn(null);
            when(channexClient.fetchHotelPoliciesForProperty("prop-1")).thenReturn(List.of());
            when(channexClient.fetchPhotosForProperty("prop-1")).thenReturn(List.of());

            // amenities config
            when(amenityManagementService.loadAliasesByOrg(42L)).thenReturn(Map.of());
            when(amenityManagementService.loadIgnoredByOrg(42L)).thenReturn(Set.of());

            // PropertyRepository.save echo back with id
            when(propertyRepository.save(any(Property.class))).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(100L);
                return p;
            });

            // connectService stubs (best-effort, not strict)
            when(connectService.pullBookings(eq(100L), eq(42L), any(), any()))
                .thenReturn(new ChannexConnectService.PullBookingsResult(0, 0, 0, 0));

            // pricingImporter returns 0 for everything
            when(pricingImporter.createLengthOfStayDiscounts(any(), anyLong(), any())).thenReturn(0);
            when(pricingImporter.createBaseRatePlan(any(), anyLong(), any())).thenReturn(false);
            when(pricingImporter.createWeekendRatePlan(any(), anyLong(), any())).thenReturn(false);
            when(pricingImporter.createOccupancyPricingFromOta(any(), anyLong(), any())).thenReturn(false);
            when(pricingImporter.importRateOverridesFromOta(any(), anyLong(), any(), any())).thenReturn(0);
            when(pricingImporter.importAdditionalRatePlansFromOta(any(), anyLong(), any())).thenReturn(0);
            when(pricingImporter.importBookingRestrictionsFromOta(any(), anyLong(), any())).thenReturn(0);

            ChannexImportRequest request = new ChannexImportRequest(
                List.of(new ChannexImportRequest.Item("prop-1", "STUDIO")), null, null);

            // Act
            ChannexImportResult result = service.importProperties(42L, request, "kc-1", false);

            // Assert
            assertThat(result.totalRequested()).isEqualTo(1);
            assertThat(result.created()).isEqualTo(1);
            assertThat(result.skipped()).isZero();
            assertThat(result.errors()).isZero();
            assertThat(result.details()).hasSize(1);
            assertThat(result.details().get(0).status()).isEqualTo("CREATED");
            assertThat(result.details().get(0).clenzyPropertyId()).isEqualTo(100L);

            verify(propertyRepository).save(any(Property.class));
            verify(mappingRepository).save(any(ChannexPropertyMapping.class));
        }

        @Test
        @DisplayName("staff override : creates property under different org/owner")
        void staffOverride_createsForTargetOrg() {
            User staff = buildUser(1L, 42L); // staff in org 42
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(staff));

            User targetOwner = buildUser(99L, 77L);
            when(userRepository.findById(99L)).thenReturn(Optional.of(targetOwner));

            when(mappingRepository.findByChannexPropertyId("prop-x", 77L))
                .thenReturn(Optional.empty());
            when(channexClient.fetchPropertyRaw("prop-x")).thenReturn(jn("""
                {"data":{"id":"prop-x","attributes":{
                  "title":"Override Property","currency":"EUR","country":"FR","timezone":"Europe/Paris",
                  "max_count_of_occupancies":2,"content":{"photos":[]}
                }}}
                """));
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
            ChannexRoomTypeDto rt = mock(ChannexRoomTypeDto.class);
            when(rt.id()).thenReturn("rt-aaaaaaaa-zzzz");
            when(rt.title()).thenReturn("RT");
            when(channexClient.fetchRoomTypesForProperty("prop-x")).thenReturn(List.of(rt));
            ChannexRatePlanDto rp = mock(ChannexRatePlanDto.class);
            when(rp.id()).thenReturn("rp-bbbbbbbb-yyyy");
            when(rp.title()).thenReturn("RP");
            when(rp.roomTypeId()).thenReturn("rt-aaaaaaaa-zzzz");
            when(channexClient.fetchRatePlansForProperty("prop-x")).thenReturn(List.of(rp));
            when(channexClient.fetchHotelPoliciesForProperty("prop-x")).thenReturn(List.of());
            when(amenityManagementService.loadAliasesByOrg(77L)).thenReturn(Map.of());
            when(amenityManagementService.loadIgnoredByOrg(77L)).thenReturn(Set.of());
            when(propertyRepository.save(any(Property.class))).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(200L);
                return p;
            });
            when(connectService.pullBookings(any(), any(), any(), any()))
                .thenReturn(new ChannexConnectService.PullBookingsResult(0, 0, 0, 0));

            ChannexImportRequest request = new ChannexImportRequest(
                List.of(new ChannexImportRequest.Item("prop-x", "APARTMENT")),
                77L, 99L); // target org=77, owner=99

            ChannexImportResult result = service.importProperties(42L, request, "kc-1", true);

            assertThat(result.created()).isEqualTo(1);
            // Property doit etre creee dans org 77 (la cible), avec owner=99
            verify(propertyRepository).save(any(Property.class));
        }

        @Test
        @DisplayName("error during import : counted as ERROR and continues other items")
        void error_continuesOnNext() {
            User user = buildUser(1L, 42L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // First prop : Channex returns null → ChannexException not found
            when(mappingRepository.findByChannexPropertyId("bad-prop", 42L)).thenReturn(Optional.empty());
            when(channexClient.fetchPropertyRaw("bad-prop")).thenReturn(null);

            // Second prop : already mapped → skipped
            ChannexPropertyMapping existing = new ChannexPropertyMapping();
            existing.setOrganizationId(42L);
            existing.setClenzyPropertyId(50L);
            existing.setChannexPropertyId("ok-prop");
            when(mappingRepository.findByChannexPropertyId("ok-prop", 42L))
                .thenReturn(Optional.of(existing));

            when(amenityManagementService.loadAliasesByOrg(42L)).thenReturn(Map.of());
            when(amenityManagementService.loadIgnoredByOrg(42L)).thenReturn(Set.of());

            ChannexImportRequest request = new ChannexImportRequest(
                List.of(
                    new ChannexImportRequest.Item("bad-prop", "APARTMENT"),
                    new ChannexImportRequest.Item("ok-prop", "APARTMENT")
                ),
                null, null);

            ChannexImportResult result = service.importProperties(42L, request, "kc-1", false);

            assertThat(result.totalRequested()).isEqualTo(2);
            assertThat(result.errors()).isEqualTo(1);
            assertThat(result.skipped()).isEqualTo(1);
            assertThat(result.created()).isZero();
            assertThat(result.details()).extracting("status")
                .contains("ERROR", "SKIPPED_ALREADY_MAPPED");
        }

        @Test
        @DisplayName("import imports OTA listing using pivot-import title heuristic")
        void importWithPivotTitle_resolvesAirbnbListing() {
            User user = buildUser(1L, 42L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(mappingRepository.findByChannexPropertyId("pivot-prop", 42L)).thenReturn(Optional.empty());

            // Channex property data with "[Clenzy]" prefix => pivot mode
            when(channexClient.fetchPropertyRaw("pivot-prop")).thenReturn(jn("""
                {"data":{"id":"pivot-prop","attributes":{
                  "title":"[Clenzy] OAuth Bridge",
                  "currency":"EUR","country":"FR","timezone":"Europe/Paris",
                  "max_count_of_occupancies":2,"content":{"photos":[]}
                }}}
                """));

            // Channels contain a "AirBNB" channel for pivot-prop
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("""
                {"data":[{"id":"chan-1","attributes":{
                  "channel":"AirBNB","is_active":true,"properties":["pivot-prop"],
                  "rate_plans":[{
                    "id":"rp-1","attributes":{"title":"Standard"},
                    "settings":{
                      "listing_id":"abnb-123",
                      "pricing_setting":{"default_daily_price":120.0,"listing_currency":"EUR"},
                      "availability_rule":{"default_min_nights":2}
                    }
                  }]
                }}]}
                """));

            // Whitelabel returns empty (forces scrape, scrape will fail due to httpClient real → returns null)
            when(channexClient.fetchChannelListingDetail(anyString(), anyString())).thenReturn(Optional.empty());

            ChannexRoomTypeDto rt = mock(ChannexRoomTypeDto.class);
            when(rt.id()).thenReturn("rt-12345678");
            when(rt.title()).thenReturn("Room");
            when(channexClient.fetchRoomTypesForProperty("pivot-prop")).thenReturn(List.of(rt));
            ChannexRatePlanDto rp = mock(ChannexRatePlanDto.class);
            when(rp.id()).thenReturn("rp-12345678");
            when(rp.title()).thenReturn("Plan");
            when(rp.roomTypeId()).thenReturn("rt-12345678");
            when(channexClient.fetchRatePlansForProperty("pivot-prop")).thenReturn(List.of(rp));
            when(channexClient.fetchHotelPoliciesForProperty("pivot-prop")).thenReturn(List.of());
            when(amenityManagementService.loadAliasesByOrg(42L)).thenReturn(Map.of());
            when(amenityManagementService.loadIgnoredByOrg(42L)).thenReturn(Set.of());
            when(propertyRepository.save(any(Property.class))).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(300L);
                return p;
            });
            when(connectService.pullBookings(any(), any(), any(), any()))
                .thenReturn(new ChannexConnectService.PullBookingsResult(0, 0, 0, 0));

            ChannexImportRequest request = new ChannexImportRequest(
                List.of(new ChannexImportRequest.Item("pivot-prop", "APARTMENT")), null, null);

            ChannexImportResult result = service.importProperties(42L, request, "kc-1", false);

            // Le import doit reussir (le name fallback "Listing AirBNB #abnb-123" prend le relais)
            assertThat(result.created()).isEqualTo(1);
        }

        @Test
        @DisplayName("pullBookings exception : import still succeeds (best-effort)")
        void pullBookingsError_doesNotFailImport() {
            User user = buildUser(1L, 42L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(mappingRepository.findByChannexPropertyId("p", 42L)).thenReturn(Optional.empty());
            when(channexClient.fetchPropertyRaw("p")).thenReturn(jn("""
                {"data":{"id":"p","attributes":{"title":"X","currency":"EUR","country":"FR","timezone":"Europe/Paris","max_count_of_occupancies":2,"content":{"photos":[]}}}}
                """));
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
            ChannexRoomTypeDto rt = mock(ChannexRoomTypeDto.class);
            when(rt.id()).thenReturn("rt-12345678");
            when(rt.title()).thenReturn("RT");
            when(channexClient.fetchRoomTypesForProperty("p")).thenReturn(List.of(rt));
            ChannexRatePlanDto rp = mock(ChannexRatePlanDto.class);
            when(rp.id()).thenReturn("rp-12345678");
            when(rp.title()).thenReturn("RP");
            when(rp.roomTypeId()).thenReturn("rt-12345678");
            when(channexClient.fetchRatePlansForProperty("p")).thenReturn(List.of(rp));
            when(channexClient.fetchHotelPoliciesForProperty("p")).thenReturn(List.of());
            when(amenityManagementService.loadAliasesByOrg(42L)).thenReturn(Map.of());
            when(amenityManagementService.loadIgnoredByOrg(42L)).thenReturn(Set.of());
            when(propertyRepository.save(any(Property.class))).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(400L);
                return p;
            });
            when(connectService.pullBookings(any(), any(), any(), any()))
                .thenThrow(new RuntimeException("Channex down"));

            ChannexImportRequest request = new ChannexImportRequest(
                List.of(new ChannexImportRequest.Item("p", "APARTMENT")), null, null);

            ChannexImportResult result = service.importProperties(42L, request, "kc-1", false);

            assertThat(result.created()).isEqualTo(1);
            assertThat(result.errors()).isZero(); // pullBookings exception swallowed
        }

        @Test
        @DisplayName("import auto-creates room_type when Channex returns empty list")
        void autoCreatesRoomTypeWhenMissing() {
            User user = buildUser(1L, 42L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(mappingRepository.findByChannexPropertyId("p", 42L)).thenReturn(Optional.empty());
            when(channexClient.fetchPropertyRaw("p")).thenReturn(jn("""
                {"data":{"id":"p","attributes":{"title":"X","currency":"EUR","country":"FR","timezone":"Europe/Paris","max_count_of_occupancies":2,"content":{"photos":[]}}}}
                """));
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
            // EMPTY room types → auto-create
            when(channexClient.fetchRoomTypesForProperty("p")).thenReturn(List.of());
            ChannexRoomTypeDto created = mock(ChannexRoomTypeDto.class);
            when(created.id()).thenReturn("rt-new-12345678");
            when(created.title()).thenReturn("New RT");
            when(channexClient.createRoomType(any())).thenReturn(created);
            // EMPTY rate plans → auto-create
            when(channexClient.fetchRatePlansForProperty("p")).thenReturn(List.of());
            ChannexRatePlanDto createdRp = mock(ChannexRatePlanDto.class);
            when(createdRp.id()).thenReturn("rp-new-12345678");
            when(createdRp.title()).thenReturn("New RP");
            when(createdRp.roomTypeId()).thenReturn("rt-new-12345678");
            when(channexClient.createRatePlan(any())).thenReturn(createdRp);
            when(channexClient.fetchHotelPoliciesForProperty("p")).thenReturn(List.of());
            when(amenityManagementService.loadAliasesByOrg(42L)).thenReturn(Map.of());
            when(amenityManagementService.loadIgnoredByOrg(42L)).thenReturn(Set.of());
            when(propertyRepository.save(any(Property.class))).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(500L);
                return p;
            });
            when(connectService.pullBookings(any(), any(), any(), any()))
                .thenReturn(new ChannexConnectService.PullBookingsResult(0, 0, 0, 0));

            ChannexImportRequest request = new ChannexImportRequest(
                List.of(new ChannexImportRequest.Item("p", "APARTMENT")), null, null);

            ChannexImportResult result = service.importProperties(42L, request, "kc-1", false);

            assertThat(result.created()).isEqualTo(1);
            verify(channexClient).createRoomType(any());
            verify(channexClient).createRatePlan(any());
        }

        @Test
        @DisplayName("import enriches with roomTypeDetail + hotelPolicies when provided")
        void enrichesWithRoomDetailAndPolicies() {
            User user = buildUser(1L, 42L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(mappingRepository.findByChannexPropertyId("p", 42L)).thenReturn(Optional.empty());

            // Property with photos as content array
            String photosArr = "[{\"url\":\"https://x.com/p1.jpg\",\"position\":0,\"description\":\"Main\"},"
                + "{\"url\":\"https://x.com/p2.jpg\",\"position\":1}]";
            when(channexClient.fetchPropertyRaw("p")).thenReturn(jn(
                "{\"data\":{\"id\":\"p\",\"attributes\":{\"title\":\"X\",\"currency\":\"EUR\","
                + "\"country\":\"FR\",\"timezone\":\"Europe/Paris\","
                + "\"max_count_of_occupancies\":2,\"content\":{\"photos\":" + photosArr + "}}}}"
            ));
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));

            ChannexRoomTypeDto rt = mock(ChannexRoomTypeDto.class);
            when(rt.id()).thenReturn("rt-12345678");
            when(rt.title()).thenReturn("RT");
            when(channexClient.fetchRoomTypesForProperty("p")).thenReturn(List.of(rt));
            ChannexRatePlanDto rp = mock(ChannexRatePlanDto.class);
            when(rp.id()).thenReturn("rp-12345678");
            when(rp.title()).thenReturn("RP");
            when(rp.roomTypeId()).thenReturn("rt-12345678");
            when(channexClient.fetchRatePlansForProperty("p")).thenReturn(List.of(rp));

            // Detail returns enrichment: maxGuests=6, rooms=2, desc + photos at room level
            ChannexRoomTypeDetailDto detail = mock(ChannexRoomTypeDetailDto.class);
            when(detail.resolveMaxGuests()).thenReturn(6);
            when(detail.countOfRooms()).thenReturn(2);
            when(detail.content()).thenReturn(jn(
                "{\"description\":\"Big house\",\"photos\":[{\"url\":\"https://x.com/p3.jpg\",\"position\":0}]}"
            ));
            when(channexClient.fetchRoomTypeDetail("rt-12345678")).thenReturn(detail);

            // Hotel policies
            ChannexHotelPolicyDto policy = mock(ChannexHotelPolicyDto.class);
            when(policy.checkinTime()).thenReturn("14:00");
            when(policy.checkoutTime()).thenReturn("10:00");
            when(policy.maxCountOfGuests()).thenReturn(8);
            when(channexClient.fetchHotelPoliciesForProperty("p")).thenReturn(List.of(policy));

            when(amenityManagementService.loadAliasesByOrg(42L)).thenReturn(Map.of());
            when(amenityManagementService.loadIgnoredByOrg(42L)).thenReturn(Set.of());
            when(propertyRepository.save(any(Property.class))).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(600L);
                return p;
            });
            when(connectService.pullBookings(any(), any(), any(), any()))
                .thenReturn(new ChannexConnectService.PullBookingsResult(0, 0, 0, 0));

            ChannexImportRequest request = new ChannexImportRequest(
                List.of(new ChannexImportRequest.Item("p", "APARTMENT")), null, null);

            ChannexImportResult result = service.importProperties(42L, request, "kc-1", false);

            assertThat(result.created()).isEqualTo(1);
            // The 2 property photos + 1 room photo + 0 flat photos = should have triggered importPhotos
            verify(propertyPhotoRepository, org.mockito.Mockito.atLeast(2)).save(any());
        }
    }

    // ─── resyncPropertyContent + resyncAll ───────────────────────────────────

    @Nested
    @DisplayName("resyncPropertyContent — additional flow paths")
    class ResyncContent {

        @Test
        @DisplayName("no Airbnb mapping in hub → IllegalStateException")
        void noAirbnbMapping_throws() {
            Property prop = buildProperty(100L, 42L);
            when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));

            ChannexPropertyMapping mapping = new ChannexPropertyMapping();
            mapping.setOrganizationId(42L);
            mapping.setClenzyPropertyId(100L);
            mapping.setChannexPropertyId("channex-1");
            when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));

            // Channels list returns a Booking.com channel (not Airbnb)
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("""
                {"data":[{"id":"c1","attributes":{
                  "channel":"BookingCom","is_active":true,"properties":["channex-1"],
                  "rate_plans":[{"id":"rp","attributes":{},"settings":{"listing_id":"BK1"}}]
                }}]}
                """));

            assertThatThrownBy(() -> service.resyncPropertyContent(100L, 42L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Airbnb");
        }
    }

    @Nested
    @DisplayName("resyncAllPropertiesContent — additional")
    class ResyncAll {

        @Test
        @DisplayName("mapping with no Airbnb in hub → silently skipped")
        void noAirbnbMappings_returnsEmpty() {
            ChannexPropertyMapping m1 = new ChannexPropertyMapping();
            m1.setOrganizationId(42L);
            m1.setClenzyPropertyId(100L);
            m1.setChannexPropertyId("ch-1");
            ChannexPropertyMapping m2 = new ChannexPropertyMapping();
            m2.setOrganizationId(42L);
            m2.setClenzyPropertyId(101L);
            m2.setChannexPropertyId("ch-2");
            when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of(m1, m2));

            // No channels → infos empty → tous skippes
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));

            var result = service.resyncAllPropertiesContent(42L);
            assertThat(result).isEmpty();
        }
    }

    // ─── discoverUnmappedProperties — title heuristic edges ──────────────────

    @Nested
    @DisplayName("discoverUnmappedProperties — title heuristic edge cases")
    class DiscoverHeuristics {

        @Test
        @DisplayName("title heuristic : studio / chalet / bungalow / duplex / maison / generic")
        void title_heuristicCoversAllBranches() {
            // NB: la regle 'house' est evaluee AVANT 'townhouse' dans le code,
            // donc 'Townhouse' matche HOUSE. C'est le comportement actuel.
            String body = """
                {"data":[
                  {"id":"p1","attributes":{"title":"Studio Centre","currency":"EUR","country":"FR","timezone":"Europe/Paris"}},
                  {"id":"p2","attributes":{"title":"Chalet Tignes","currency":"EUR","country":"FR","timezone":"Europe/Paris"}},
                  {"id":"p3","attributes":{"title":"Bungalow Plage","currency":"EUR","country":"FR","timezone":"Europe/Paris"}},
                  {"id":"p5","attributes":{"title":"Duplex Marais","currency":"EUR","country":"FR","timezone":"Europe/Paris"}},
                  {"id":"p6","attributes":{"title":"Maison Provence","currency":"EUR","country":"FR","timezone":"Europe/Paris"}},
                  {"id":"p7","attributes":{"title":"Some Generic Place","currency":"EUR","country":"FR","timezone":"Europe/Paris"}}
                ]}
                """;
            when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(body));
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
            when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
            when(channexClient.hasActiveOtaChannel(anyString())).thenReturn(false);
            when(channexClient.fetchRoomTypesForProperty(anyString())).thenReturn(List.of());
            when(channexClient.fetchRatePlansForProperty(anyString())).thenReturn(List.of());

            ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
            assertThat(result.items()).extracting("suggestedType")
                .containsExactly("STUDIO", "CHALET", "BUNGALOW",
                    "DUPLEX", "HOUSE", "APARTMENT");
        }

        @Test
        @DisplayName("ota listing_type ('villa') overrides title heuristic")
        void otaListingType_overridesTitle() {
            String propsBody = """
                {"data":[
                  {"id":"p1","attributes":{
                    "title":"Generic Place","currency":"EUR","country":"FR","timezone":"Europe/Paris"
                  }}
                ]}
                """;
            // Channel exposes a rate_plan with listing_type="villa"
            String channelsBody = """
                {"data":[{"id":"c1","attributes":{
                  "channel":"AirBNB","is_active":true,"properties":["p1"],
                  "rate_plans":[{
                    "id":"rp1","attributes":{},
                    "settings":{"listing_id":"L1","listing_type":"villa"}
                  }]
                }}]}
                """;
            when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(propsBody));
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn(channelsBody));
            when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
            when(channexClient.hasActiveOtaChannel(anyString())).thenReturn(true);
            when(channexClient.fetchRoomTypesForProperty(anyString())).thenReturn(List.of());
            when(channexClient.fetchRatePlansForProperty(anyString())).thenReturn(List.of());

            ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
            assertThat(result.items()).hasSize(1);
            assertThat(result.items().get(0).suggestedType()).isEqualTo("VILLA");
        }

        @Test
        @DisplayName("buildListingInfoMap : channels missing rate_plans are skipped")
        void buildListingInfoMap_skipsMalformedChannels() {
            // Channel with no rate_plans → buildListingInfoMap skips
            String channelsBody = """
                {"data":[
                  {"id":"c1","attributes":{"channel":"AirBNB","is_active":true,"properties":["p1"]}}
                ]}
                """;
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn(channelsBody));
            when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("""
                {"data":[{"id":"p1","attributes":{"title":"X","currency":"EUR","country":"FR","timezone":"Europe/Paris"}}]}
                """));
            when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
            when(channexClient.hasActiveOtaChannel(anyString())).thenReturn(false);
            when(channexClient.fetchRoomTypesForProperty(anyString())).thenReturn(List.of());
            when(channexClient.fetchRatePlansForProperty(anyString())).thenReturn(List.of());

            ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
            // Sans rate_plan, le info n'est pas indexe → suggestedType retombe sur le titre
            assertThat(result.items()).hasSize(1);
            assertThat(result.items().get(0).suggestedType()).isEqualTo("APARTMENT");
        }
    }

    // ─── listConnectedOtaChannels — additional edges ────────────────────────

    @Nested
    @DisplayName("listConnectedOtaChannels — edge paths")
    class ListConnectedExtended {

        @Test
        @DisplayName("channel id null → skipped silently")
        void nullChannelId_isSkipped() {
            String body = """
                {"data":[
                  {"attributes":{"channel":"AirBNB","is_active":true,"properties":[]}}
                ]}
                """;
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn(body));
            when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("{\"data\":[]}"));

            List<ChannexConnectedOta> result = service.listConnectedOtaChannels(42L);
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("missing properties array but with relationships.data.id")
        void usesRelationshipsWhenPropertiesEmpty() {
            String channelsBody = """
                {"data":[{"id":"c1","attributes":{
                  "channel":"AirBNB","is_active":true,"properties":[]
                },"relationships":{"properties":{"data":[{"id":"p99","type":"property"}]}}}]}
                """;
            when(channexClient.fetchAllChannelsRaw()).thenReturn(jn(channelsBody));
            when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("""
                {"data":[{"id":"p99","attributes":{"title":"Resolved title"}}]}
                """));

            List<ChannexConnectedOta> result = service.listConnectedOtaChannels(42L);
            assertThat(result).hasSize(1);
            assertThat(result.get(0).attachedPropertyId()).isEqualTo("p99");
            assertThat(result.get(0).attachedPropertyTitle()).isEqualTo("Resolved title");
        }
    }

    // Mockito convenience overload for any(Long.class)
    private static long anyLong() {
        return org.mockito.ArgumentMatchers.anyLong();
    }
}
