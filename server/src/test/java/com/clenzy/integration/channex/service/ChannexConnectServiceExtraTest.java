package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexChannelDto;
import com.clenzy.integration.channex.dto.ChannexOtaChannelResponse;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexOtaChannelRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests supplementaires pour {@link ChannexConnectService} :
 *   - list / getByPropertyId
 *   - getEmbedUrl (succes + erreur)
 *   - createOtaChannel (succes + property sans mapping)
 *   - updatePriceSourceOfTruth (validation cross-tenant)
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexConnectService — extra coverage")
class ChannexConnectServiceExtraTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private ChannexOtaChannelRepository otaChannelRepository;
    @Mock private ChannexSyncService syncService;
    @Mock private ChannexBookingService bookingService;
    @Mock private PropertyRepository propertyRepository;
    @Mock private com.clenzy.integration.channex.repository.ChannexPriceDriftRepository priceDriftRepository;

    private ChannexConnectService service;

    @BeforeEach
    void setUp() {
        service = new ChannexConnectService(
            channexClient, mappingRepository, otaChannelRepository, syncService, bookingService,
            propertyRepository,
            new ChannexMetrics(new SimpleMeterRegistry()),
            new ChannexCapabilityService(),
            priceDriftRepository
        );
    }

    private Property property(Long id, Long orgId, String name) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        p.setName(name);
        return p;
    }

    private ChannexPropertyMapping mapping(Long clenzyId, Long orgId, String channexId) {
        ChannexPropertyMapping m = new ChannexPropertyMapping();
        m.setId(UUID.randomUUID());
        m.setClenzyPropertyId(clenzyId);
        m.setOrganizationId(orgId);
        m.setChannexPropertyId(channexId);
        return m;
    }

    // ─── list ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("list: delegue au repository")
    void list_delegatesToRepository() {
        List<ChannexPropertyMapping> list = List.of(mapping(1L, 42L, "ch-1"), mapping(2L, 42L, "ch-2"));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(list);

        assertThat(service.list(42L)).isEqualTo(list);
    }

    @Test
    @DisplayName("list: pas de mapping -> liste vide")
    void list_empty() {
        when(mappingRepository.findAllByOrgId(99L)).thenReturn(List.of());
        assertThat(service.list(99L)).isEmpty();
    }

    // ─── getByPropertyId ────────────────────────────────────────────────────

    @Test
    @DisplayName("getByPropertyId: present -> Optional non-vide")
    void getByPropertyId_present() {
        ChannexPropertyMapping m = mapping(10L, 42L, "ch-x");
        when(mappingRepository.findByClenzyPropertyId(10L, 42L)).thenReturn(Optional.of(m));

        assertThat(service.getByPropertyId(10L, 42L)).contains(m);
    }

    @Test
    @DisplayName("getByPropertyId: absent -> Optional vide")
    void getByPropertyId_absent() {
        when(mappingRepository.findByClenzyPropertyId(11L, 42L)).thenReturn(Optional.empty());
        assertThat(service.getByPropertyId(11L, 42L)).isEmpty();
    }

    // ─── getEmbedUrl ────────────────────────────────────────────────────────

    @Test
    @DisplayName("getEmbedUrl: mapping inexistant -> IllegalStateException")
    void getEmbedUrl_noMapping() {
        when(mappingRepository.findByClenzyPropertyId(99L, 42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getEmbedUrl(99L, 42L, "admin@x.fr", "fr", null))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Aucun mapping Channex");
    }

    @Test
    @DisplayName("getEmbedUrl: mapping present -> delegue au client + retourne URL")
    void getEmbedUrl_succeeds() {
        ChannexPropertyMapping m = mapping(100L, 42L, "ch-100");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(m));
        when(channexClient.createEmbedUrl(eq("ch-100"), eq("admin@x.fr"), eq("fr"), eq("ABB")))
            .thenReturn("https://embed.channex.io/abc");

        String url = service.getEmbedUrl(100L, 42L, "admin@x.fr", "fr", "ABB");
        assertThat(url).isEqualTo("https://embed.channex.io/abc");
        verify(channexClient).createEmbedUrl("ch-100", "admin@x.fr", "fr", "ABB");
    }

    @Test
    @DisplayName("getEmbedUrl: channelCode null -> delegue avec null (toute la liste)")
    void getEmbedUrl_nullChannelCode() {
        ChannexPropertyMapping m = mapping(100L, 42L, "ch-100");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(m));
        when(channexClient.createEmbedUrl(eq("ch-100"), anyString(), anyString(), org.mockito.ArgumentMatchers.isNull()))
            .thenReturn("https://embed.channex.io/all");

        String url = service.getEmbedUrl(100L, 42L, "admin@x.fr", "fr", null);
        assertThat(url).isEqualTo("https://embed.channex.io/all");
    }

    // ─── createOtaChannel ───────────────────────────────────────────────────

    @Test
    @DisplayName("createOtaChannel: mapping inexistant -> IllegalStateException")
    void createOtaChannel_noMapping() {
        when(mappingRepository.findByClenzyPropertyId(99L, 42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createOtaChannel(99L, 42L, "Airbnb", "admin@x.fr", "fr"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Aucun mapping Channex");
    }

    @Test
    @DisplayName("createOtaChannel: property introuvable -> IllegalStateException")
    void createOtaChannel_propertyNotFound() {
        ChannexPropertyMapping m = mapping(100L, 42L, "ch-100");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(m));
        when(propertyRepository.findById(100L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createOtaChannel(100L, 42L, "Airbnb", "admin@x.fr", "fr"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("introuvable");
    }

    @Test
    @DisplayName("createOtaChannel: succes -> createChannel + createChannelEmbedUrl")
    void createOtaChannel_succeeds() {
        ChannexPropertyMapping m = mapping(100L, 42L, "ch-100");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(m));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property(100L, 42L, "Studio Marais")));
        when(channexClient.fetchPropertyGroupId("ch-100")).thenReturn("group-xyz");
        ChannexChannelDto created = new ChannexChannelDto("chan-1", "Airbnb - Studio Marais", "Airbnb", false);
        when(channexClient.createChannel(any())).thenReturn(created);
        when(channexClient.createChannelEmbedUrl(eq("ch-100"), eq("chan-1"), anyString(), anyString()))
            .thenReturn("https://embed.channex.io/oauth");

        ChannexOtaChannelResponse result = service.createOtaChannel(100L, 42L, "Airbnb", "admin@x.fr", "fr");

        assertThat(result.channelId()).isEqualTo("chan-1");
        assertThat(result.channelTitle()).isEqualTo("Airbnb - Studio Marais");
        assertThat(result.embedUrl()).isEqualTo("https://embed.channex.io/oauth");
    }

    @Test
    @DisplayName("createOtaChannel: property avec nom null -> fallback 'Propriete #ID'")
    void createOtaChannel_nullPropertyName_usesFallback() {
        ChannexPropertyMapping m = mapping(100L, 42L, "ch-100");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(m));
        Property p = property(100L, 42L, null);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(p));
        when(channexClient.fetchPropertyGroupId("ch-100")).thenReturn(null);
        ChannexChannelDto created = new ChannexChannelDto("chan-2", "Airbnb - Propriete #100", "Airbnb", false);
        when(channexClient.createChannel(any())).thenReturn(created);
        when(channexClient.createChannelEmbedUrl(any(), any(), any(), any()))
            .thenReturn("https://embed.channex.io/x");

        ChannexOtaChannelResponse result = service.createOtaChannel(100L, 42L, "Airbnb", "admin@x.fr", "fr");
        assertThat(result.channelTitle()).contains("Propriete #100");
    }

    @Test
    @DisplayName("createOtaChannel: property avec nom blanc -> fallback 'Propriete #ID'")
    void createOtaChannel_blankPropertyName() {
        ChannexPropertyMapping m = mapping(100L, 42L, "ch-100");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(m));
        Property p = property(100L, 42L, "   ");
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(p));
        when(channexClient.fetchPropertyGroupId("ch-100")).thenReturn("g1");
        ChannexChannelDto created = new ChannexChannelDto("chan-3", "Airbnb - Propriete #100", "Airbnb", false);
        when(channexClient.createChannel(any())).thenReturn(created);
        when(channexClient.createChannelEmbedUrl(any(), any(), any(), any()))
            .thenReturn("https://embed.channex.io/x");

        ChannexOtaChannelResponse result = service.createOtaChannel(100L, 42L, "Airbnb", "admin@x.fr", "fr");
        assertThat(result).isNotNull();
    }

    // ─── updatePriceSourceOfTruth ───────────────────────────────────────────

    @Test
    @DisplayName("updatePriceSourceOfTruth: property introuvable -> IllegalStateException")
    void updatePrice_propertyNotFound() {
        when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updatePriceSourceOfTruth(99L, 42L,
            com.clenzy.model.PriceSourceOfTruth.CLENZY))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("introuvable");
    }

    @Test
    @DisplayName("updatePriceSourceOfTruth: succes -> set + save + retourne le statut")
    void updatePrice_success() {
        Property p = property(100L, 42L, "P");
        p.setPriceSourceOfTruth(com.clenzy.model.PriceSourceOfTruth.OTA);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(p));

        com.clenzy.model.PriceSourceOfTruth result = service.updatePriceSourceOfTruth(100L, 42L,
            com.clenzy.model.PriceSourceOfTruth.CLENZY);

        assertThat(result).isEqualTo(com.clenzy.model.PriceSourceOfTruth.CLENZY);
        assertThat(p.getPriceSourceOfTruth()).isEqualTo(com.clenzy.model.PriceSourceOfTruth.CLENZY);
        verify(propertyRepository).save(p);
    }

    @Test
    @DisplayName("PullBookingsResult: record exposes all fields")
    void pullBookingsResult_recordWorks() {
        ChannexConnectService.PullBookingsResult r =
            new ChannexConnectService.PullBookingsResult(5, 3, 1, 1);
        assertThat(r.totalReceived()).isEqualTo(5);
        assertThat(r.importedOrIdempotent()).isEqualTo(3);
        assertThat(r.skipped()).isEqualTo(1);
        assertThat(r.errors()).isEqualTo(1);
    }
}
