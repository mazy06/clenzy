package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexDiscoveryResponse;
import com.clenzy.integration.channex.dto.ChannexImportRequest;
import com.clenzy.integration.channex.dto.ChannexImportResult;
import com.clenzy.integration.channex.dto.ChannexOauthSetupResponse;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDto;
import com.clenzy.integration.channex.dto.ChannexRatePlanDto;
import com.clenzy.integration.channex.exception.ChannexException;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests supplementaires couvrant les branches restantes de
 * {@link ChannexImportService} :
 * <ul>
 *   <li>setupGlobalOauth: existingChannelId null + existingChannelId blank</li>
 *   <li>discoverUnmappedProperties: items null in attributes</li>
 *   <li>importProperties: multiple properties batch (createRoomType failure, etc.)</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("ChannexImportService — extra coverage")
class ChannexImportServiceExtraTest {

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

    // ─── setupGlobalOauth: empty existingChannelId variants ───────────────────

    @Test
    @DisplayName("setupGlobalOauth: existingChannelId vide -> traite comme null (cree nouvelle pivot)")
    void setupGlobalOauth_blankExistingChannelId() {
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("{\"data\":[]}"));
        ChannexPropertyDto created = new ChannexPropertyDto(
            "new-pivot", "[Clenzy Hub] OAuth Bridge", "EUR", null, "Europe/Paris");
        when(channexClient.createProperty(any())).thenReturn(created);
        when(channexClient.createEmbedUrl(any(), any(), any(), any())).thenReturn("https://embed.x/y");

        ChannexOauthSetupResponse result = service.setupGlobalOauth(42L, "admin@x.fr",
            "ABB", "fr", "");

        assertThat(result.pivotPropertyId()).isEqualTo("new-pivot");
        // existingChannelId vide => pas de createChannelEmbedUrl, cree pivot
        verify(channexClient).createProperty(any());
    }

    @Test
    @DisplayName("setupGlobalOauth: existingChannelId not in hub -> IllegalStateException")
    void setupGlobalOauth_existingChannelIdNotInHub() {
        // Le channel n'existe pas dans le hub Channex
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));

        assertThatThrownBy(() -> service.setupGlobalOauth(42L, "admin@x.fr", "ABB", "fr", "chan-missing"))
            .isInstanceOf(IllegalStateException.class);
    }

    // ─── discoverUnmappedProperties: edge cases ──────────────────────────────

    @Test
    @DisplayName("discoverUnmappedProperties: item sans attributes -> skip silently")
    void discover_itemWithoutAttributes() {
        // Item sans bloc 'attributes' (donc title=null etc)
        String body = """
            {"data":[
              {"id":"p1"}
            ]}
            """;
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(body));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
        when(channexClient.hasActiveOtaChannel(anyString())).thenReturn(false);
        when(channexClient.fetchRoomTypesForProperty(anyString())).thenReturn(List.of());
        when(channexClient.fetchRatePlansForProperty(anyString())).thenReturn(List.of());

        ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
        // Doit retourner 1 item meme sans attributes (titre = null, etc.)
        assertThat(result.totalInHub()).isEqualTo(1);
    }

    @Test
    @DisplayName("discoverUnmappedProperties: item sans id -> skip silently")
    void discover_itemWithoutId() {
        String body = """
            {"data":[
              {"attributes":{"title":"No ID"}}
            ]}
            """;
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(body));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());

        ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
        // Item sans id -> skip
        assertThat(result.items()).isEmpty();
    }

    // ─── importProperties: multiple items mix ────────────────────────────────

    @Test
    @DisplayName("importProperties: liste vide -> totalRequested=0")
    void importProperties_emptyList() {
        com.clenzy.model.User user = new com.clenzy.model.User();
        user.setId(1L);
        user.setOrganizationId(42L);
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
        when(amenityManagementService.loadAliasesByOrg(42L)).thenReturn(Map.of());
        when(amenityManagementService.loadIgnoredByOrg(42L)).thenReturn(Set.of());

        ChannexImportRequest request = new ChannexImportRequest(List.of(), null, null);

        ChannexImportResult result = service.importProperties(42L, request, "kc-1", false);

        assertThat(result.totalRequested()).isZero();
        assertThat(result.created()).isZero();
        assertThat(result.skipped()).isZero();
        assertThat(result.errors()).isZero();
    }

    @Test
    @DisplayName("importProperties: createRoomType throws -> error counted, autres items continuent")
    void importProperties_createRoomTypeFail() {
        com.clenzy.model.User user = new com.clenzy.model.User();
        user.setId(1L);
        user.setOrganizationId(42L);
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
        when(mappingRepository.findByChannexPropertyId("prop-fail", 42L)).thenReturn(Optional.empty());

        when(channexClient.fetchPropertyRaw("prop-fail")).thenReturn(jn("""
            {"data":{"id":"prop-fail","attributes":{
              "title":"X","currency":"EUR","country":"FR","timezone":"Europe/Paris",
              "max_count_of_occupancies":2,"content":{"photos":[]}
            }}}
            """));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
        // Empty room types -> tries createRoomType which throws
        when(channexClient.fetchRoomTypesForProperty("prop-fail")).thenReturn(List.of());
        when(channexClient.createRoomType(any())).thenThrow(new ChannexException(
            ChannexException.Kind.SERVER_ERROR, "create RT failed"));
        when(amenityManagementService.loadAliasesByOrg(42L)).thenReturn(Map.of());
        when(amenityManagementService.loadIgnoredByOrg(42L)).thenReturn(Set.of());

        ChannexImportRequest request = new ChannexImportRequest(
            List.of(new ChannexImportRequest.Item("prop-fail", "APARTMENT")), null, null);

        ChannexImportResult result = service.importProperties(42L, request, "kc-1", false);

        assertThat(result.errors()).isEqualTo(1);
        assertThat(result.created()).isZero();
    }

    // ─── listConnectedOtaChannels: relationships malformed ───────────────────

    @Test
    @DisplayName("listConnectedOtaChannels: properties null/missing -> empty list of attached")
    void listConnectedOtaChannels_noProperties() {
        String channelsBody = """
            {"data":[
              {"id":"chan-1","attributes":{
                "title":"Standalone",
                "channel":"AirBNB",
                "is_active":true
              }}
            ]}
            """;
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn(channelsBody));
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("{\"data\":[]}"));

        var result = service.listConnectedOtaChannels(42L);
        assertThat(result).hasSize(1);
        // sans properties -> attachedPropertyId null
        assertThat(result.get(0).attachedPropertyId()).isNull();
        assertThat(result.get(0).attachedPropertyTitle()).isEqualTo("");
    }

    // ─── resyncAllPropertiesContent: branche supplementaire ──────────────────

    @Test
    @DisplayName("resyncAllPropertiesContent: mappings present mais skip si pas Airbnb")
    void resyncAll_skipNonAirbnb() {
        // 1 mapping mais le hub ne contient que des channels Booking.com
        ChannexPropertyMapping m = new ChannexPropertyMapping();
        m.setOrganizationId(42L);
        m.setClenzyPropertyId(100L);
        m.setChannexPropertyId("ch-100");
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of(m));

        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("""
            {"data":[{"id":"c1","attributes":{
              "channel":"BookingCom","is_active":true,"properties":["ch-100"],
              "rate_plans":[{"id":"rp","attributes":{},"settings":{"listing_id":"BK1"}}]
            }}]}
            """));

        var result = service.resyncAllPropertiesContent(42L);
        // skip Booking.com - retourne liste vide
        assertThat(result).isEmpty();
    }
}
