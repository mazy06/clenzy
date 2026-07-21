package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexConnectedOta;
import com.clenzy.integration.channex.dto.ChannexDiscoveryResponse;
import com.clenzy.integration.channex.dto.ChannexOauthSetupResponse;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de {@link ChannexImportService} pour les methodes publiques
 * qui ne sont PAS deja couvertes par {@link ChannexImportServicePricingTest}.
 *
 * <p>Couvre :</p>
 * <ul>
 *   <li>discoverUnmappedProperties (filtrage pivots, enrichissement OTA)</li>
 *   <li>listConnectedOtaChannels (extraction des channels actifs du hub)</li>
 *   <li>disconnectOtaChannel (deactivate + delete en 2 etapes)</li>
 *   <li>setupGlobalOauth (creation pivot + URL embed)</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexImportService — public methods")
class ChannexImportServiceTest {

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
            bookingRestrictionRepository,
            objectMapper, amenityManagementService, pricingImporter, selfProvider);
        // Le service s'appelle via le proxy Spring pour la tx courte de
        // persistance — en test unitaire, self = l'instance elle-meme.
        lenient().when(selfProvider.getObject()).thenAnswer(inv -> service);
    }

    private JsonNode jn(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // ─── discoverUnmappedProperties ─────────────────────────────────────────

    @Test
    @DisplayName("discoverUnmappedProperties: hub vide → response avec totalInHub=0 + items=[]")
    void discover_emptyHub() {
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("{\"data\":[]}"));

        ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
        assertThat(result.totalInHub()).isZero();
        assertThat(result.items()).isEmpty();
    }

    @Test
    @DisplayName("discoverUnmappedProperties: data null → response vide")
    void discover_nullData() {
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(null);

        ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
        assertThat(result.totalInHub()).isZero();
        assertThat(result.items()).isEmpty();
    }

    @Test
    @DisplayName("discoverUnmappedProperties: pivot sans OTA actif est masquee (dormante)")
    void discover_pivotWithoutOtaIsHidden() {
        // 1 pivot sans OTA actif → cachee
        String body = """
            {"data":[
              {"id":"pivot-1","attributes":{
                "title":"[Clenzy Hub] OAuth Bridge",
                "currency":"EUR","country":"FR","timezone":"Europe/Paris"
              }}
            ]}
            """;
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(body));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
        when(channexClient.hasActiveOtaChannel("pivot-1")).thenReturn(false);

        ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
        assertThat(result.totalInHub()).isEqualTo(1);
        // Pivot sans OTA est cachée
        assertThat(result.items()).isEmpty();
    }

    @Test
    @DisplayName("discoverUnmappedProperties: property standard non importée → listée comme unmapped")
    void discover_standardPropertyListed() {
        String body = """
            {"data":[
              {"id":"prop-1","attributes":{
                "title":"Mon Studio",
                "currency":"EUR","country":"FR","timezone":"Europe/Paris",
                "max_count_of_occupancies":4
              }}
            ]}
            """;
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(body));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
        lenient().when(channexClient.hasActiveOtaChannel(anyString())).thenReturn(false);
        lenient().when(channexClient.fetchRoomTypesForProperty(anyString())).thenReturn(List.of());
        lenient().when(channexClient.fetchRatePlansForProperty(anyString())).thenReturn(List.of());

        ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
        assertThat(result.totalInHub()).isEqualTo(1);
        assertThat(result.items()).hasSize(1);
        var item = result.items().get(0);
        assertThat(item.channexPropertyId()).isEqualTo("prop-1");
        assertThat(item.title()).isEqualTo("Mon Studio");
        assertThat(item.currency()).isEqualTo("EUR");
        assertThat(item.maxOccupancy()).isEqualTo(4);
        assertThat(item.isImported()).isFalse();
        assertThat(item.suggestedType()).isEqualTo("STUDIO");
    }

    @Test
    @DisplayName("discoverUnmappedProperties: property deja mappee → isImported=true + clenzyId resolu")
    void discover_alreadyMappedProperty() {
        String body = """
            {"data":[
              {"id":"prop-1","attributes":{
                "title":"Loft Marais",
                "currency":"EUR","country":"FR","timezone":"Europe/Paris"
              }}
            ]}
            """;
        ChannexPropertyMapping existingMapping = new ChannexPropertyMapping();
        existingMapping.setId(UUID.randomUUID());
        existingMapping.setOrganizationId(42L);
        existingMapping.setClenzyPropertyId(555L);
        existingMapping.setChannexPropertyId("prop-1");

        Property clenzyProp = new Property();
        clenzyProp.setId(555L);
        clenzyProp.setName("Loft Marais Clenzy");

        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(body));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of(existingMapping));
        when(propertyRepository.findById(555L)).thenReturn(Optional.of(clenzyProp));
        lenient().when(channexClient.hasActiveOtaChannel(anyString())).thenReturn(true);
        lenient().when(channexClient.fetchRoomTypesForProperty(anyString())).thenReturn(List.of());
        lenient().when(channexClient.fetchRatePlansForProperty(anyString())).thenReturn(List.of());

        ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
        assertThat(result.items()).hasSize(1);
        var item = result.items().get(0);
        assertThat(item.isImported()).isTrue();
        assertThat(item.clenzyPropertyId()).isEqualTo(555L);
        assertThat(item.clenzyPropertyName()).isEqualTo("Loft Marais Clenzy");
    }

    @Test
    @DisplayName("discoverUnmappedProperties: hasActiveOtaChannel KO → loggue debug, hasOta=false")
    void discover_handlesOtaCheckError() {
        String body = """
            {"data":[
              {"id":"prop-1","attributes":{
                "title":"Studio",
                "currency":"EUR","country":"FR","timezone":"Europe/Paris"
              }}
            ]}
            """;
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(body));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
        // OTA check leve mais on continue gracefully
        when(channexClient.hasActiveOtaChannel(anyString()))
            .thenThrow(new RuntimeException("Channex down"));
        lenient().when(channexClient.fetchRoomTypesForProperty(anyString())).thenReturn(List.of());
        lenient().when(channexClient.fetchRatePlansForProperty(anyString())).thenReturn(List.of());

        ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
        // Toujours liste OK (l'erreur sur l'OTA check ne casse pas le flow)
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).hasActiveOta()).isFalse();
    }

    @Test
    @DisplayName("discoverUnmappedProperties: enrichissement avec channel actif → otaInfo present")
    void discover_enrichesWithChannelInfo() {
        String propsBody = """
            {"data":[
              {"id":"prop-1","attributes":{
                "title":"Mon Studio",
                "currency":"EUR","country":"FR","timezone":"Europe/Paris"
              }}
            ]}
            """;
        // 1 channel Airbnb actif, lie a prop-1, avec tokens
        String channelsBody = """
            {"data":[
              {"id":"chan-1","attributes":{
                "channel":"AirBNB",
                "is_active":true,
                "properties":["prop-1"],
                "settings":{"tokens":{"access_token":"tok-abc"}},
                "rate_plans":[]
              }}
            ]}
            """;
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(propsBody));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn(channelsBody));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
        lenient().when(channexClient.hasActiveOtaChannel(anyString())).thenReturn(true);
        lenient().when(channexClient.fetchRoomTypesForProperty(anyString())).thenReturn(List.of());
        lenient().when(channexClient.fetchRatePlansForProperty(anyString())).thenReturn(List.of());

        ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
        assertThat(result.items()).hasSize(1);
        var item = result.items().get(0);
        assertThat(item.connectedOtas()).hasSize(1);
        assertThat(item.connectedOtas().get(0).otaName()).isEqualTo("AirBNB");
        assertThat(item.connectedOtas().get(0).isActive()).isTrue();
        assertThat(item.connectedOtas().get(0).hasOauthToken()).isTrue();
    }

    @Test
    @DisplayName("discoverUnmappedProperties: heuristique title (Villa/Loft/Riad)")
    void discover_suggestsTypeFromTitle() {
        String body = """
            {"data":[
              {"id":"p1","attributes":{"title":"Villa Bord de Mer","currency":"EUR","country":"FR","timezone":"Europe/Paris"}},
              {"id":"p2","attributes":{"title":"Loft Industrial","currency":"EUR","country":"FR","timezone":"Europe/Paris"}},
              {"id":"p3","attributes":{"title":"Riad Marrakech","currency":"EUR","country":"FR","timezone":"Europe/Paris"}}
            ]}
            """;
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(body));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
        lenient().when(channexClient.hasActiveOtaChannel(anyString())).thenReturn(false);
        lenient().when(channexClient.fetchRoomTypesForProperty(anyString())).thenReturn(List.of());
        lenient().when(channexClient.fetchRatePlansForProperty(anyString())).thenReturn(List.of());

        ChannexDiscoveryResponse result = service.discoverUnmappedProperties(42L);
        assertThat(result.items()).extracting("suggestedType")
            .containsExactly("VILLA", "LOFT", "RIAD");
    }

    // ─── listConnectedOtaChannels ───────────────────────────────────────────

    @Test
    @DisplayName("listConnectedOtaChannels: hub vide → liste vide")
    void listConnectedOtaChannels_emptyHub() {
        when(channexClient.fetchAllChannelsRaw()).thenReturn(null);
        assertThat(service.listConnectedOtaChannels(42L)).isEmpty();
    }

    @Test
    @DisplayName("listConnectedOtaChannels: data vide → liste vide")
    void listConnectedOtaChannels_emptyData() {
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"meta\":{}}"));
        assertThat(service.listConnectedOtaChannels(42L)).isEmpty();
    }

    @Test
    @DisplayName("listConnectedOtaChannels: 2 channels → 2 ChannexConnectedOta")
    void listConnectedOtaChannels_returnsList() {
        String channelsBody = """
            {"data":[
              {"id":"chan-1","attributes":{
                "title":"My Airbnb",
                "channel":"AirBNB",
                "is_active":true,
                "properties":["prop-1"],
                "settings":{"tokens":{"access_token":"tok-1"}}
              }},
              {"id":"chan-2","attributes":{
                "title":"Booking FR",
                "channel":"BookingCom",
                "is_active":false,
                "properties":[]
              }}
            ]}
            """;
        String propsBody = """
            {"data":[
              {"id":"prop-1","attributes":{"title":"Studio Paris"}}
            ]}
            """;
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn(channelsBody));
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(propsBody));

        List<ChannexConnectedOta> result = service.listConnectedOtaChannels(42L);
        assertThat(result).hasSize(2);
        assertThat(result.get(0).channelId()).isEqualTo("chan-1");
        assertThat(result.get(0).otaName()).isEqualTo("AirBNB");
        assertThat(result.get(0).isActive()).isTrue();
        assertThat(result.get(0).hasOauthToken()).isTrue();
        assertThat(result.get(0).attachedPropertyTitle()).isEqualTo("Studio Paris");
        assertThat(result.get(0).attachedPropertyId()).isEqualTo("prop-1");

        assertThat(result.get(1).channelId()).isEqualTo("chan-2");
        assertThat(result.get(1).isActive()).isFalse();
        assertThat(result.get(1).hasOauthToken()).isFalse();
        // pas de property attache → title vide + id null
        assertThat(result.get(1).attachedPropertyId()).isNull();
    }

    @Test
    @DisplayName("listConnectedOtaChannels: channel sans properties[] mais avec relationships.properties.data")
    void listConnectedOtaChannels_relationshipsProperties() {
        String channelsBody = """
            {"data":[
              {"id":"chan-1","attributes":{
                "title":"My Airbnb",
                "channel":"AirBNB",
                "is_active":true
              },
              "relationships":{"properties":{"data":[{"id":"prop-2","type":"property"}]}}}
            ]}
            """;
        String propsBody = """
            {"data":[
              {"id":"prop-2","attributes":{"title":"Other Studio"}}
            ]}
            """;
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn(channelsBody));
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(propsBody));

        List<ChannexConnectedOta> result = service.listConnectedOtaChannels(42L);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).attachedPropertyId()).isEqualTo("prop-2");
        assertThat(result.get(0).attachedPropertyTitle()).isEqualTo("Other Studio");
    }

    // ─── disconnectOtaChannel ───────────────────────────────────────────────

    @Test
    @DisplayName("disconnectOtaChannel: deactivate puis delete, succes 2-step")
    void disconnectOtaChannel_succeeds() {
        // pas d'exception
        service.disconnectOtaChannel(42L, "chan-1");

        verify(channexClient).deactivateChannel("chan-1");
        verify(channexClient).deleteChannel("chan-1");
    }

    @Test
    @DisplayName("disconnectOtaChannel: deactivate KO → tente quand meme delete")
    void disconnectOtaChannel_deactivateFailsButDeleteTried() {
        org.mockito.Mockito.doThrow(new ChannexException(ChannexException.Kind.SERVER_ERROR,
            "deactivate down")).when(channexClient).deactivateChannel("chan-1");

        // Pas d'exception car delete passe (mock par defaut)
        service.disconnectOtaChannel(42L, "chan-1");

        verify(channexClient).deactivateChannel("chan-1");
        verify(channexClient).deleteChannel("chan-1");
    }

    @Test
    @DisplayName("disconnectOtaChannel: delete KO → re-throw (chan reste desactive)")
    void disconnectOtaChannel_deleteFailsRethrows() {
        org.mockito.Mockito.doThrow(new RuntimeException("delete down"))
            .when(channexClient).deleteChannel("chan-1");

        assertThatThrownBy(() -> service.disconnectOtaChannel(42L, "chan-1"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("delete down");

        verify(channexClient).deactivateChannel("chan-1");
        verify(channexClient).deleteChannel("chan-1");
    }

    // ─── setupGlobalOauth ───────────────────────────────────────────────────

    @Test
    @DisplayName("setupGlobalOauth: existingChannelId fourni + property attachee → reuse + URL embed")
    void setupGlobalOauth_reusesExistingChannel() {
        String channelsBody = """
            {"data":[
              {"id":"chan-existing","attributes":{
                "properties":["pivot-old"]
              }}
            ]}
            """;
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn(channelsBody));
        when(channexClient.createChannelEmbedUrl(eq("pivot-old"), eq("chan-existing"),
            anyString(), anyString())).thenReturn("https://embed.channex.io/x");

        ChannexOauthSetupResponse result = service.setupGlobalOauth(42L,
            "admin@x.fr", "ABB", "fr", "chan-existing");

        assertThat(result.embedUrl()).isEqualTo("https://embed.channex.io/x");
        assertThat(result.pivotPropertyId()).isEqualTo("pivot-old");
        // Pas de create property (on reuse)
        verify(channexClient, never()).createProperty(any());
    }

    @Test
    @DisplayName("setupGlobalOauth: existingChannelId fourni mais pas de property attachee → IllegalStateException")
    void setupGlobalOauth_existingChannelOrphan() {
        String channelsBody = """
            {"data":[
              {"id":"chan-existing","attributes":{"properties":[]}}
            ]}
            """;
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn(channelsBody));

        assertThatThrownBy(() -> service.setupGlobalOauth(42L,
            "admin@x.fr", "ABB", "fr", "chan-existing"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("sans property attachee");
    }

    @Test
    @DisplayName("setupGlobalOauth: pas de pivot existante → cree une nouvelle + embed URL")
    void setupGlobalOauth_createsNewPivot() {
        // Aucune pivot dans le hub
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("{\"data\":[]}"));
        ChannexPropertyDto created = new ChannexPropertyDto(
            "new-pivot-id", "[Clenzy Hub] OAuth Bridge", "EUR", null, "Europe/Paris");
        when(channexClient.createProperty(any())).thenReturn(created);
        when(channexClient.createEmbedUrl(eq("new-pivot-id"), anyString(), anyString(), anyString()))
            .thenReturn("https://embed.channex.io/new");

        ChannexOauthSetupResponse result = service.setupGlobalOauth(42L,
            "admin@x.fr", "ABB", "fr", null);

        assertThat(result.embedUrl()).isEqualTo("https://embed.channex.io/new");
        assertThat(result.pivotPropertyId()).isEqualTo("new-pivot-id");
        verify(channexClient).createProperty(any());
    }

    @Test
    @DisplayName("setupGlobalOauth: pivot existante supprimable → delete + cree nouvelle")
    void setupGlobalOauth_deletesOrphanPivot() {
        String pivotsBody = """
            {"data":[
              {"id":"pivot-old","attributes":{"title":"[Clenzy Hub] OAuth Bridge"}}
            ]}
            """;
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(pivotsBody));
        // delete OK (pas d'exception)
        ChannexPropertyDto created = new ChannexPropertyDto(
            "new-pivot", "[Clenzy Hub] OAuth Bridge", "EUR", null, "Europe/Paris");
        when(channexClient.createProperty(any())).thenReturn(created);
        when(channexClient.createEmbedUrl(eq("new-pivot"), anyString(), anyString(), anyString()))
            .thenReturn("https://embed.channex.io/n");

        ChannexOauthSetupResponse result = service.setupGlobalOauth(42L,
            "admin@x.fr", "ABB", "fr", null);

        assertThat(result.pivotPropertyId()).isEqualTo("new-pivot");
        verify(channexClient).deleteProperty("pivot-old");
        verify(channexClient).createProperty(any());
    }

    @Test
    @DisplayName("setupGlobalOauth: pivot existante NON supprimable → rename puis cree nouvelle")
    void setupGlobalOauth_renamesPivotIfDeleteFails() {
        String pivotsBody = """
            {"data":[
              {"id":"pivot-old","attributes":{"title":"[Clenzy Hub] OAuth Bridge"}}
            ]}
            """;
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(pivotsBody));
        // Delete leve (canal OAuth attache)
        org.mockito.Mockito.doThrow(new RuntimeException("channel attached"))
            .when(channexClient).deleteProperty("pivot-old");
        // Rename OK
        ChannexPropertyDto created = new ChannexPropertyDto(
            "new-pivot", "[Clenzy Hub] OAuth Bridge", "EUR", null, "Europe/Paris");
        when(channexClient.createProperty(any())).thenReturn(created);
        when(channexClient.createEmbedUrl(eq("new-pivot"), anyString(), anyString(), anyString()))
            .thenReturn("https://embed.channex.io/n");

        service.setupGlobalOauth(42L, "admin@x.fr", "ABB", "fr", null);

        verify(channexClient).updatePropertyTitle(eq("pivot-old"), anyString());
        verify(channexClient).createProperty(any());
    }

    @Test
    @DisplayName("setupGlobalOauth: rename KO aussi → on continue (loggue warning + cree nouvelle)")
    void setupGlobalOauth_renameAlsoFails() {
        String pivotsBody = """
            {"data":[
              {"id":"pivot-old","attributes":{"title":"[Clenzy Hub] OAuth Bridge"}}
            ]}
            """;
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(pivotsBody));
        org.mockito.Mockito.doThrow(new RuntimeException("delete fail"))
            .when(channexClient).deleteProperty("pivot-old");
        org.mockito.Mockito.doThrow(new RuntimeException("rename fail"))
            .when(channexClient).updatePropertyTitle(eq("pivot-old"), anyString());
        ChannexPropertyDto created = new ChannexPropertyDto(
            "new-pivot", "title", "EUR", null, "Europe/Paris");
        when(channexClient.createProperty(any())).thenReturn(created);
        when(channexClient.createEmbedUrl(any(), any(), any(), any()))
            .thenReturn("https://embed.channex.io/n");

        // Ne plante pas — la nouvelle pivot est creee
        ChannexOauthSetupResponse result = service.setupGlobalOauth(42L,
            "admin@x.fr", "ABB", "fr", null);
        assertThat(result.pivotPropertyId()).isEqualTo("new-pivot");
    }

    // ─── resyncPropertyContent : edge cases ─────────────────────────────────

    @Test
    @DisplayName("resyncPropertyContent: property introuvable → IllegalArgumentException")
    void resyncPropertyContent_propertyNotFound() {
        when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resyncPropertyContent(999L, 42L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("introuvable");
    }

    @Test
    @DisplayName("resyncPropertyContent: org mismatch → SecurityException")
    void resyncPropertyContent_orgMismatch() {
        Property prop = new Property();
        prop.setId(100L);
        prop.setOrganizationId(99L); // different
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));

        assertThatThrownBy(() -> service.resyncPropertyContent(100L, 42L))
            .isInstanceOf(SecurityException.class)
            .hasMessageContaining("organisation");
    }

    @Test
    @DisplayName("resyncPropertyContent: mapping introuvable → IllegalStateException")
    void resyncPropertyContent_noMapping() {
        Property prop = new Property();
        prop.setId(100L);
        prop.setOrganizationId(42L);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resyncPropertyContent(100L, 42L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Aucun mapping Channex");
    }

    // ─── resyncAllPropertiesContent ─────────────────────────────────────────

    @Test
    @DisplayName("resyncAllPropertiesContent: aucun mapping → liste vide")
    void resyncAllPropertiesContent_noMappings() {
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));

        var result = service.resyncAllPropertiesContent(42L);
        assertThat(result).isEmpty();
    }

    // ─── importProperties : validations ──────────────────────────────────────

    @Test
    @DisplayName("importProperties: requesterKeycloakId null → IllegalStateException")
    void importProperties_nullKeycloakId() {
        var request = new com.clenzy.integration.channex.dto.ChannexImportRequest(
            List.of(new com.clenzy.integration.channex.dto.ChannexImportRequest.Item(
                "prop-1", "APARTMENT")),
            null, null);

        assertThatThrownBy(() -> service.importProperties(42L, request, null, false))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("identite utilisateur manquante");
    }

    @Test
    @DisplayName("importProperties: requesterKeycloakId vide → IllegalStateException")
    void importProperties_blankKeycloakId() {
        var request = new com.clenzy.integration.channex.dto.ChannexImportRequest(
            List.of(new com.clenzy.integration.channex.dto.ChannexImportRequest.Item(
                "prop-1", "APARTMENT")),
            null, null);

        assertThatThrownBy(() -> service.importProperties(42L, request, "", false))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("importProperties: user introuvable → IllegalStateException")
    void importProperties_userNotFound() {
        when(userRepository.findByKeycloakId("kc-x")).thenReturn(Optional.empty());
        var request = new com.clenzy.integration.channex.dto.ChannexImportRequest(
            List.of(new com.clenzy.integration.channex.dto.ChannexImportRequest.Item(
                "prop-1", "APARTMENT")),
            null, null);

        assertThatThrownBy(() -> service.importProperties(42L, request, "kc-x", false))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("aucun User Clenzy");
    }

    @Test
    @DisplayName("importProperties: staff avec targetOrgId mais pas targetOwnerId → IllegalArgumentException")
    void importProperties_staffMissingOwnerOverride() {
        com.clenzy.model.User user = new com.clenzy.model.User();
        user.setId(1L);
        user.setOrganizationId(42L);
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

        var request = new com.clenzy.integration.channex.dto.ChannexImportRequest(
            List.of(new com.clenzy.integration.channex.dto.ChannexImportRequest.Item(
                "prop-1", "APARTMENT")),
            999L, null); // targetOrg sans targetOwner

        assertThatThrownBy(() -> service.importProperties(42L, request, "kc-1", true))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("targetOwnerId est requis");
    }

    @Test
    @DisplayName("importProperties: staff avec targetOwnerId mais pas targetOrgId → IllegalArgumentException")
    void importProperties_staffMissingOrgOverride() {
        com.clenzy.model.User user = new com.clenzy.model.User();
        user.setId(1L);
        user.setOrganizationId(42L);
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

        var request = new com.clenzy.integration.channex.dto.ChannexImportRequest(
            List.of(new com.clenzy.integration.channex.dto.ChannexImportRequest.Item(
                "prop-1", "APARTMENT")),
            null, 555L); // targetOwner sans targetOrg

        assertThatThrownBy(() -> service.importProperties(42L, request, "kc-1", true))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("targetOrganizationId est requis");
    }

    @Test
    @DisplayName("importProperties: staff cible owner d'une autre org → IllegalArgumentException coherence")
    void importProperties_staffOwnerOrgMismatch() {
        com.clenzy.model.User staff = new com.clenzy.model.User();
        staff.setId(1L);
        staff.setOrganizationId(42L);
        when(userRepository.findByKeycloakId("kc-staff")).thenReturn(Optional.of(staff));

        com.clenzy.model.User targetOwner = new com.clenzy.model.User();
        targetOwner.setId(555L);
        targetOwner.setOrganizationId(99L); // org differente de targetOrgId
        when(userRepository.findById(555L)).thenReturn(Optional.of(targetOwner));

        var request = new com.clenzy.integration.channex.dto.ChannexImportRequest(
            List.of(new com.clenzy.integration.channex.dto.ChannexImportRequest.Item(
                "prop-1", "APARTMENT")),
            77L, 555L); // targetOrg=77, owner appartient a 99 → mismatch

        assertThatThrownBy(() -> service.importProperties(42L, request, "kc-staff", true))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Incoherence");
    }

    @Test
    @DisplayName("importProperties: skip silencieux si Channex property deja mappee (idempotent)")
    void importProperties_skipIfAlreadyMapped() {
        com.clenzy.model.User user = new com.clenzy.model.User();
        user.setId(1L);
        user.setOrganizationId(42L);
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

        // mapping deja existant pour prop-1
        ChannexPropertyMapping existing = new ChannexPropertyMapping();
        existing.setOrganizationId(42L);
        existing.setClenzyPropertyId(100L);
        existing.setChannexPropertyId("prop-1");
        when(mappingRepository.findByChannexPropertyId("prop-1", 42L))
            .thenReturn(Optional.of(existing));

        when(amenityManagementService.loadAliasesByOrg(42L)).thenReturn(java.util.Map.of());
        when(amenityManagementService.loadIgnoredByOrg(42L)).thenReturn(java.util.Set.of());
        lenient().when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));

        var request = new com.clenzy.integration.channex.dto.ChannexImportRequest(
            List.of(new com.clenzy.integration.channex.dto.ChannexImportRequest.Item(
                "prop-1", "APARTMENT")),
            null, null);

        var result = service.importProperties(42L, request, "kc-1", false);

        assertThat(result.created()).isZero();
        assertThat(result.skipped()).isEqualTo(1);
        assertThat(result.errors()).isZero();
        assertThat(result.details().get(0).status()).isEqualTo("SKIPPED_ALREADY_MAPPED");
        verify(propertyRepository, never()).save(any());
    }
}
