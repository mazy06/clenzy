package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.service.ChannexCapabilityService;
import com.clenzy.integration.channex.dto.ChannexConnectRequest;
import com.clenzy.integration.channex.dto.ChannexCreatePropertyRequest;
import com.clenzy.integration.channex.dto.ChannexCreateRatePlanRequest;
import com.clenzy.integration.channex.dto.ChannexBookingDto;
import com.clenzy.integration.channex.dto.ChannexBookingsListResponse;
import com.clenzy.integration.channex.dto.ChannexCreateRoomTypeRequest;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.dto.ChannexRatePlanDto;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDto;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexOtaChannelRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexConnectService")
class ChannexConnectServiceTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private ChannexOtaChannelRepository otaChannelRepository;
    @Mock private ChannexSyncService syncService;
    @Mock private ChannexBookingService bookingService;
    @Mock private PropertyRepository propertyRepository;

    private ChannexConnectService service;

    @BeforeEach
    void setUp() {
        service = new ChannexConnectService(
            channexClient, mappingRepository, otaChannelRepository, syncService, bookingService,
            propertyRepository,
            new ChannexMetrics(new SimpleMeterRegistry()),
            new ChannexCapabilityService()
        );
    }

    private Property property(Long id, Long orgId) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        p.setName("Studio Marais");
        return p;
    }

    private ChannexConnectRequest request() {
        return ChannexConnectRequest.importExisting("channex-prop-1", "channex-room-1", "channex-rate-1");
    }

    // ─── Connect ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("connect: property introuvable -> IllegalStateException")
    void connect_propertyNotFound() {
        when(propertyRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.connect(99L, 42L, request()))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("introuvable");
    }

    @Test
    @DisplayName("connect: property d'une autre organisation -> IllegalStateException")
    void connect_crossTenantProperty() {
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property(100L, 999L)));

        assertThatThrownBy(() -> service.connect(100L, 42L, request()))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("n'appartient pas a l'organisation");
    }

    @Test
    @DisplayName("connect: mapping deja existant -> IllegalStateException")
    void connect_alreadyMapped() {
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property(100L, 42L)));
        ChannexPropertyMapping existing = new ChannexPropertyMapping();
        existing.setId(UUID.randomUUID());
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.connect(100L, 42L, request()))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("deja connectee");
    }

    @Test
    @DisplayName("connect: property Channex inexistante -> IllegalStateException avec message clair")
    void connect_channexPropertyNotFound() {
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property(100L, 42L)));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());
        when(channexClient.getProperty("channex-prop-1"))
            .thenThrow(new ChannexException(ChannexException.Kind.NOT_FOUND, 404, "not found"));

        assertThatThrownBy(() -> service.connect(100L, 42L, request()))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Property Channex introuvable")
            .hasMessageContaining("dashboard Channex");

        verify(mappingRepository, never()).save(any());
    }

    @Test
    @DisplayName("connect: succes -> cree mapping en PENDING SANS declencher de push initial (attend OTA actif)")
    void connect_success() {
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property(100L, 42L)));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());
        when(channexClient.getProperty("channex-prop-1"))
            .thenReturn(new ChannexPropertyDto("channex-prop-1", "Studio Marais", "EUR", null, "Europe/Paris"));

        ChannexPropertyMapping saved = new ChannexPropertyMapping();
        saved.setId(UUID.randomUUID());
        saved.setOrganizationId(42L);
        saved.setClenzyPropertyId(100L);
        saved.setChannexPropertyId("channex-prop-1");
        saved.setChannexRoomTypeId("channex-room-1");
        saved.setChannexDefaultRatePlanId("channex-rate-1");
        saved.setSyncStatus(ChannexSyncStatus.PENDING);

        when(mappingRepository.save(any())).thenReturn(saved);

        ChannexPropertyMapping result = service.connect(100L, 42L, request());

        assertThat(result.getChannexPropertyId()).isEqualTo("channex-prop-1");
        assertThat(result.getClenzyPropertyId()).isEqualTo(100L);
        verify(channexClient).getProperty("channex-prop-1");
        verify(mappingRepository).save(any());
        // Plus de push initial : il sera declenche par le frontend apres OAuth
        // OTA ou par le scheduler periodique (qui skip si pas d'OTA actif).
        verify(syncService, org.mockito.Mockito.never()).pushProperty(anyLong(), anyLong(), any(), any());
    }

    // ─── AUTO_CREATE mode ───────────────────────────────────────────────────

    @Test
    @DisplayName("connect[AUTO_CREATE]: succes -> appelle createProperty + createRoomType + createRatePlan dans Channex")
    void connect_autoCreate_callsAllThreeChannexEndpoints() {
        Property p = property(100L, 42L);
        p.setName("Studio Marais");
        p.setMaxGuests(2);
        p.setDefaultCurrency("EUR");
        p.setCountryCode("FR");

        when(propertyRepository.findById(100L)).thenReturn(Optional.of(p));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());

        // Mock des 3 appels Channex
        when(channexClient.createProperty(any(ChannexCreatePropertyRequest.class)))
            .thenReturn(new ChannexPropertyDto("chx-prop-auto", "Studio Marais", "EUR", null, "Europe/Paris"));
        when(channexClient.createRoomType(any(ChannexCreateRoomTypeRequest.class)))
            .thenReturn(new ChannexRoomTypeDto("chx-room-auto", "Studio Marais", "chx-prop-auto", 1));
        when(channexClient.createRatePlan(any(ChannexCreateRatePlanRequest.class)))
            .thenReturn(new ChannexRatePlanDto("chx-rate-auto", "Standard Rate", "chx-prop-auto", "chx-room-auto", "EUR", "per_room"));

        ChannexPropertyMapping saved = new ChannexPropertyMapping();
        saved.setId(UUID.randomUUID());
        saved.setChannexPropertyId("chx-prop-auto");
        saved.setChannexRoomTypeId("chx-room-auto");
        saved.setChannexDefaultRatePlanId("chx-rate-auto");
        when(mappingRepository.save(any())).thenReturn(saved);
        // PAS de mock pushProperty : connect() ne push plus a la creation
        // (attend qu'un OTA soit connecte).

        ChannexPropertyMapping result = service.connect(100L, 42L, ChannexConnectRequest.autoCreate());

        assertThat(result.getChannexPropertyId()).isEqualTo("chx-prop-auto");
        assertThat(result.getChannexRoomTypeId()).isEqualTo("chx-room-auto");
        assertThat(result.getChannexDefaultRatePlanId()).isEqualTo("chx-rate-auto");
        verify(channexClient).createProperty(any());
        verify(channexClient).createRoomType(any());
        verify(channexClient).createRatePlan(any());
        // getProperty PAS appele en mode AUTO_CREATE
        verify(channexClient, never()).getProperty(any());
    }

    @Test
    @DisplayName("connect[AUTO_CREATE]: API key Channex invalide -> message d'erreur explicite")
    void connect_autoCreate_unauthorizedHasFriendlyMessage() {
        Property p = property(100L, 42L);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(p));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());
        when(channexClient.createProperty(any()))
            .thenThrow(new ChannexException(ChannexException.Kind.UNAUTHORIZED, "missing api key"));

        assertThatThrownBy(() -> service.connect(100L, 42L, ChannexConnectRequest.autoCreate()))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("CHANNEX_API_KEY");

        verify(mappingRepository, never()).save(any());
        verify(channexClient, never()).createRoomType(any());
    }

    @Test
    @DisplayName("connect[IMPORT_EXISTING]: 3 IDs manquants -> IllegalStateException explicite")
    void connect_importExisting_requiresAllThreeIds() {
        Property p = property(100L, 42L);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(p));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());

        // Mode IMPORT mais aucun ID fourni
        ChannexConnectRequest req = new ChannexConnectRequest(
            ChannexConnectRequest.Mode.IMPORT_EXISTING, null, null, null
        );

        assertThatThrownBy(() -> service.connect(100L, 42L, req))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("3 IDs Channex sont obligatoires");

        verify(mappingRepository, never()).save(any());
        verify(channexClient, never()).getProperty(any());
    }

    // ─── Disconnect ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("disconnect: mapping inexistant -> IllegalStateException")
    void disconnect_notFound() {
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.disconnect(100L, 42L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Aucun mapping");
    }

    @Test
    @DisplayName("disconnect: succes -> supprime ota_channels puis mapping")
    void disconnect_success() {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(otaChannelRepository.findByMappingId(mapping.getId())).thenReturn(List.of());

        service.disconnect(100L, 42L);

        verify(otaChannelRepository).findByMappingId(mapping.getId());
        verify(mappingRepository).delete(mapping);
    }

    // ─── PullBookings (reverse sync) ────────────────────────────────────────

    @Test
    @DisplayName("pullBookings: mapping inexistant -> IllegalStateException")
    void pullBookings_noMapping() {
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.pullBookings(100L, 42L,
            java.time.LocalDate.now(), java.time.LocalDate.now().plusMonths(6)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Aucun mapping Channex");
    }

    @Test
    @DisplayName("pullBookings: succes -> appelle handleNewBooking pour chaque booking + retourne counters")
    void pullBookings_success() {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setChannexPropertyId("chx-prop-1");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));

        ChannexBookingDto b1 = new ChannexBookingDto(
            "booking-1", "HM1", "airbnb", "chx-prop-1", "new",
            java.time.LocalDate.of(2026, 8, 1), java.time.LocalDate.of(2026, 8, 5),
            java.math.BigDecimal.valueOf(450), "EUR",
            null, List.of()
        );
        ChannexBookingDto b2 = new ChannexBookingDto(
            "booking-2", "HM2", "booking_com", "chx-prop-1", "new",
            java.time.LocalDate.of(2026, 9, 1), java.time.LocalDate.of(2026, 9, 7),
            java.math.BigDecimal.valueOf(800), "EUR",
            null, List.of()
        );
        when(channexClient.listBookings(eq("chx-prop-1"), any(), any()))
            .thenReturn(new ChannexBookingsListResponse(List.of(b1, b2)));

        com.clenzy.model.Reservation r1 = new com.clenzy.model.Reservation();
        r1.setId(1L);
        com.clenzy.model.Reservation r2 = new com.clenzy.model.Reservation();
        r2.setId(2L);
        when(bookingService.handleNewBooking(b1)).thenReturn(r1);
        when(bookingService.handleNewBooking(b2)).thenReturn(r2);

        ChannexConnectService.PullBookingsResult result = service.pullBookings(
            100L, 42L, java.time.LocalDate.now(), java.time.LocalDate.now().plusMonths(6)
        );

        assertThat(result.totalReceived()).isEqualTo(2);
        assertThat(result.importedOrIdempotent()).isEqualTo(2);
        assertThat(result.errors()).isEqualTo(0);
        verify(bookingService).handleNewBooking(b1);
        verify(bookingService).handleNewBooking(b2);
    }

    @Test
    @DisplayName("pullBookings: aucun booking dans Channex -> result avec counters a zero")
    void pullBookings_empty() {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setChannexPropertyId("chx-prop-1");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(channexClient.listBookings(eq("chx-prop-1"), any(), any()))
            .thenReturn(new ChannexBookingsListResponse(List.of()));

        ChannexConnectService.PullBookingsResult result = service.pullBookings(
            100L, 42L, java.time.LocalDate.now(), java.time.LocalDate.now().plusMonths(6)
        );

        assertThat(result.totalReceived()).isEqualTo(0);
        assertThat(result.importedOrIdempotent()).isEqualTo(0);
        verify(bookingService, never()).handleNewBooking(any());
    }

    @Test
    @DisplayName("pullBookings: erreur Channex API -> IllegalStateException avec message")
    void pullBookings_channexError() {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setChannexPropertyId("chx-prop-1");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(channexClient.listBookings(eq("chx-prop-1"), any(), any()))
            .thenThrow(new ChannexException(ChannexException.Kind.SERVER_ERROR, "Channex 503"));

        assertThatThrownBy(() -> service.pullBookings(100L, 42L,
            java.time.LocalDate.now(), java.time.LocalDate.now().plusMonths(6)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Erreur lors de l'import");
    }

    // ─── Resync ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("resync: months hors plage clampe a [1, 12]")
    void resync_clampsMonths() {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setSyncStatus(ChannexSyncStatus.ACTIVE);
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(syncService.pushProperty(anyLong(), anyLong(), any(), any()))
            .thenReturn(new ChannexSyncService.ChannexSyncResult(true, "ok", 30, 30));

        // -5 mois -> clampe a 1 (pas d'exception)
        ChannexSyncService.ChannexSyncResult r1 = service.resync(100L, 42L, -5);
        assertThat(r1.success()).isTrue();

        // 50 mois -> clampe a 12
        ChannexSyncService.ChannexSyncResult r2 = service.resync(100L, 42L, 50);
        assertThat(r2.success()).isTrue();
    }

    @Test
    @DisplayName("resync: si mapping DISABLED -> repasse en PENDING avant push")
    void resync_reactivatesDisabled() {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setSyncStatus(ChannexSyncStatus.DISABLED);
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(syncService.pushProperty(anyLong(), anyLong(), any(), any()))
            .thenReturn(new ChannexSyncService.ChannexSyncResult(true, "ok", 30, 30));

        service.resync(100L, 42L, 1);

        // Save appele pour le changement DISABLED -> PENDING
        verify(mappingRepository).save(any());
    }

    // ─── getEmbedUrl (Channex iframe widget) ────────────────────────────────

    @Test
    @DisplayName("getEmbedUrl: mapping inexistant -> IllegalStateException explicite")
    void getEmbedUrl_noMapping() {
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getEmbedUrl(100L, 42L, "admin@clenzy.fr", "fr", null))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Aucun mapping Channex");
    }

    @Test
    @DisplayName("getEmbedUrl: succes -> delegue au client avec le channex_property_id du mapping")
    void getEmbedUrl_delegates() {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setChannexPropertyId("channex-prop-uuid");
        mapping.setSyncStatus(ChannexSyncStatus.ACTIVE);
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(channexClient.createEmbedUrl(eq("channex-prop-uuid"), eq("admin@clenzy.fr"),
                eq("fr"), eq("ABB")))
            .thenReturn("https://staging.channex.io/auth/exchange?oauth_session_key=t&available_channels=ABB");

        String url = service.getEmbedUrl(100L, 42L, "admin@clenzy.fr", "fr", "ABB");

        assertThat(url).startsWith("https://staging.channex.io/auth/exchange");
        assertThat(url).contains("available_channels=ABB");
        verify(channexClient).createEmbedUrl("channex-prop-uuid", "admin@clenzy.fr", "fr", "ABB");
    }

    // ─── Tiny helper for ArgumentMatchers.eq ────────────────────────────────
    private static <T> T eq(T value) { return org.mockito.ArgumentMatchers.eq(value); }

    // ─── Phase 1-3 : fullDisconnect / runPreflight / diagnose / health ──────

    private static com.fasterxml.jackson.databind.JsonNode channelsJsonWithProperty(String propertyId,
                                                                                     boolean active,
                                                                                     String... channelIds)
            throws Exception {
        StringBuilder sb = new StringBuilder("{\"data\":[");
        for (int i = 0; i < channelIds.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("{")
              .append("\"id\":\"").append(channelIds[i]).append("\",")
              .append("\"attributes\":{")
              .append("\"is_active\":").append(active).append(',')
              .append("\"properties\":[\"").append(propertyId).append("\"]")
              .append("}}");
        }
        sb.append("]}");
        return new com.fasterxml.jackson.databind.ObjectMapper().readTree(sb.toString());
    }

    private static com.fasterxml.jackson.databind.JsonNode emptyChannelsJson() throws Exception {
        return new com.fasterxml.jackson.databind.ObjectMapper().readTree("{\"data\":[]}");
    }

    @Test
    @DisplayName("fullDisconnect: mapping inexistant -> IllegalStateException")
    void fullDisconnect_notFound() {
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> service.fullDisconnect(100L, 42L, false))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("rien a deconnecter");
    }

    @Test
    @DisplayName("fullDisconnect: succes complet -> deactivate + delete channels + cleanup local, overallSuccess=true")
    void fullDisconnect_happyPath() throws Exception {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setChannexPropertyId("channex-prop-1");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(channexClient.fetchAllChannelsRaw())
            .thenReturn(channelsJsonWithProperty("channex-prop-1", true, "chan-A", "chan-B"));
        when(otaChannelRepository.findByMappingId(mapping.getId())).thenReturn(List.of());

        var result = service.fullDisconnect(100L, 42L, false);

        assertThat(result.overallSuccess()).isTrue();
        assertThat(result.clenzyPropertyId()).isEqualTo(100L);
        assertThat(result.channexPropertyId()).isEqualTo("channex-prop-1");
        // 1 LIST + 2*(DEACTIVATE+DELETE) + 1 SKIPPED_DELETE_PROPERTY + 1 CLEANUP_LOCAL = 7 steps
        assertThat(result.steps()).hasSize(7);
        verify(channexClient).deactivateChannel("chan-A");
        verify(channexClient).deactivateChannel("chan-B");
        verify(channexClient).deleteChannel("chan-A");
        verify(channexClient).deleteChannel("chan-B");
        verify(channexClient, never()).deleteProperty(any());
        verify(mappingRepository).delete(mapping);
    }

    @Test
    @DisplayName("fullDisconnect: deleteChannexProperty=true -> appelle aussi deleteProperty")
    void fullDisconnect_deleteChannexProperty() throws Exception {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setChannexPropertyId("channex-prop-1");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(emptyChannelsJson());
        when(otaChannelRepository.findByMappingId(mapping.getId())).thenReturn(List.of());

        var result = service.fullDisconnect(100L, 42L, true);

        assertThat(result.overallSuccess()).isTrue();
        verify(channexClient).deleteProperty("channex-prop-1");
        // Le step DELETE_PROPERTY doit etre SUCCESS, pas SKIPPED
        assertThat(result.steps()).anySatisfy(s -> {
            assertThat(s.code()).isEqualTo("DELETE_PROPERTY");
            assertThat(s.status())
                .isEqualTo(com.clenzy.integration.channex.dto.ChannexFullDisconnectResult.Status.SUCCESS);
        });
    }

    @Test
    @DisplayName("fullDisconnect: deactivate echoue -> cleanup local quand meme + overallSuccess=false")
    void fullDisconnect_deactivateFails() throws Exception {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setChannexPropertyId("channex-prop-1");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(channexClient.fetchAllChannelsRaw())
            .thenReturn(channelsJsonWithProperty("channex-prop-1", true, "chan-A"));
        doThrow(new ChannexException(ChannexException.Kind.SERVER_ERROR, "503"))
            .when(channexClient).deactivateChannel("chan-A");
        when(otaChannelRepository.findByMappingId(mapping.getId())).thenReturn(List.of());

        var result = service.fullDisconnect(100L, 42L, false);

        assertThat(result.overallSuccess()).isFalse();
        // Cleanup local DOIT etre execute meme si Channex echoue
        verify(mappingRepository).delete(mapping);
    }

    @Test
    @DisplayName("runPreflight: global only (no propertyId) + API OK -> canProceed=true avec 3 checks")
    void runPreflight_globalOk() throws Exception {
        when(channexClient.fetchAllPropertiesRaw())
            .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree("{\"data\":[{\"id\":\"p1\"},{\"id\":\"p2\"}]}"));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());

        var report = service.runPreflight(42L, null);

        assertThat(report.canProceed()).isTrue();
        assertThat(report.checks()).hasSize(3); // API + CAPABILITIES + HUB
        assertThat(report.checks()).allMatch(c ->
            c.severity() == com.clenzy.integration.channex.dto.ChannexPreflightReport.Severity.OK);
    }

    @Test
    @DisplayName("runPreflight: API Channex 401 -> BLOCKER avec remediation explicite")
    void runPreflight_apiUnauthorized() {
        when(channexClient.fetchAllPropertiesRaw())
            .thenThrow(new ChannexException(ChannexException.Kind.UNAUTHORIZED, "invalid api key"));

        var report = service.runPreflight(42L, null);

        assertThat(report.canProceed()).isFalse();
        assertThat(report.checks()).anySatisfy(c -> {
            assertThat(c.code()).isEqualTo("API_REACHABLE");
            assertThat(c.severity())
                .isEqualTo(com.clenzy.integration.channex.dto.ChannexPreflightReport.Severity.BLOCKER);
            assertThat(c.remediation()).contains("CHANNEX_API_KEY");
        });
    }

    @Test
    @DisplayName("runPreflight: property deja mappee -> BLOCKER PROPERTY_NOT_MAPPED")
    void runPreflight_alreadyMapped() throws Exception {
        when(channexClient.fetchAllPropertiesRaw())
            .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper().readTree("{\"data\":[]}"));
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());
        Property p = property(100L, 42L);
        p.setDefaultCurrency("EUR");
        p.setCountryCode("FR");
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(p));
        ChannexPropertyMapping existing = new ChannexPropertyMapping();
        existing.setId(UUID.randomUUID());
        existing.setSyncStatus(ChannexSyncStatus.ACTIVE);
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(existing));

        var report = service.runPreflight(42L, 100L);

        assertThat(report.canProceed()).isFalse();
        assertThat(report.checks()).anySatisfy(c -> {
            assertThat(c.code()).isEqualTo("PROPERTY_NOT_MAPPED");
            assertThat(c.severity())
                .isEqualTo(com.clenzy.integration.channex.dto.ChannexPreflightReport.Severity.BLOCKER);
        });
    }

    @Test
    @DisplayName("diagnose: ACTIVE + OTA actifs -> FORCE_RESYNC primary + OPEN_HUB secondary")
    void diagnose_activeWithOtas() throws Exception {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setChannexPropertyId("channex-prop-1");
        mapping.setSyncStatus(ChannexSyncStatus.ACTIVE);
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property(100L, 42L)));
        when(channexClient.fetchAllChannelsRaw())
            .thenReturn(channelsJsonWithProperty("channex-prop-1", true, "chan-A"));

        var report = service.diagnose(100L, 42L);

        assertThat(report.sync().activeOtaCount()).isEqualTo(1);
        assertThat(report.recommendedActions()).hasSize(2);
        assertThat(report.recommendedActions().get(0).code()).isEqualTo("FORCE_RESYNC");
        assertThat(report.recommendedActions().get(0).priority())
            .isEqualTo(com.clenzy.integration.channex.dto.ChannexDiagnosisReport.Priority.PRIMARY);
        assertThat(report.recommendedActions().get(1).code()).isEqualTo("OPEN_HUB");
        assertThat(report.summary()).contains("active");
    }

    @Test
    @DisplayName("diagnose: ERROR + 0 OTA -> FULL_DISCONNECT primary (orphelin)")
    void diagnose_errorNoOtas() throws Exception {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setClenzyPropertyId(100L);
        mapping.setOrganizationId(42L);
        mapping.setChannexPropertyId("channex-prop-1");
        mapping.setSyncStatus(ChannexSyncStatus.ERROR);
        mapping.setLastSyncError("Push 503");
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property(100L, 42L)));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(emptyChannelsJson());

        var report = service.diagnose(100L, 42L);

        assertThat(report.sync().hasActiveOta()).isFalse();
        assertThat(report.recommendedActions().get(0).code()).isEqualTo("FULL_DISCONNECT");
        assertThat(report.recommendedActions().get(0).priority())
            .isEqualTo(com.clenzy.integration.channex.dto.ChannexDiagnosisReport.Priority.PRIMARY);
        assertThat(report.summary()).contains("orphelin");
    }

    @Test
    @DisplayName("computeHealthSummary: vide -> totalMappings=0, attentionItems vide")
    void healthSummary_empty() {
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of());

        var summary = service.computeHealthSummary(42L);

        assertThat(summary.totalMappings()).isZero();
        assertThat(summary.attentionItems()).isEmpty();
        // Tous les statuses doivent etre presents avec count=0
        assertThat(summary.countsByStatus()).hasSize(ChannexSyncStatus.values().length);
        assertThat(summary.countsByStatus().values()).allMatch(v -> v == 0);
    }

    @Test
    @DisplayName("computeHealthSummary: mix ACTIVE+ERROR -> compte correct, ERROR dans attentionItems")
    void healthSummary_mixedStatuses() {
        ChannexPropertyMapping ok = new ChannexPropertyMapping();
        ok.setId(UUID.randomUUID());
        ok.setClenzyPropertyId(100L);
        ok.setOrganizationId(42L);
        ok.setSyncStatus(ChannexSyncStatus.ACTIVE);
        ok.setLastSyncAt(java.time.Instant.now()); // fresh

        ChannexPropertyMapping bad = new ChannexPropertyMapping();
        bad.setId(UUID.randomUUID());
        bad.setClenzyPropertyId(200L);
        bad.setOrganizationId(42L);
        bad.setSyncStatus(ChannexSyncStatus.ERROR);
        bad.setLastSyncError("Boom");

        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of(ok, bad));
        when(propertyRepository.findAllById(List.of(100L, 200L)))
            .thenReturn(List.of(property(100L, 42L), property(200L, 42L)));

        var summary = service.computeHealthSummary(42L);

        assertThat(summary.totalMappings()).isEqualTo(2);
        assertThat(summary.countsByStatus().get(ChannexSyncStatus.ACTIVE)).isEqualTo(1);
        assertThat(summary.countsByStatus().get(ChannexSyncStatus.ERROR)).isEqualTo(1);
        assertThat(summary.attentionItems()).hasSize(1);
        assertThat(summary.attentionItems().get(0).clenzyPropertyId()).isEqualTo(200L);
        assertThat(summary.attentionItems().get(0).severity())
            .isEqualTo(com.clenzy.integration.channex.dto.ChannexHealthSummary.Severity.ERROR);
        assertThat(summary.attentionItems().get(0).organizationId()).isEqualTo(42L);
    }
}
