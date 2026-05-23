package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexConnectRequest;
import com.clenzy.integration.channex.dto.ChannexCreatePropertyRequest;
import com.clenzy.integration.channex.dto.ChannexCreateRatePlanRequest;
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
    @Mock private PropertyRepository propertyRepository;

    private ChannexConnectService service;

    @BeforeEach
    void setUp() {
        service = new ChannexConnectService(
            channexClient, mappingRepository, otaChannelRepository, syncService, propertyRepository,
            new ChannexMetrics(new SimpleMeterRegistry())
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
    @DisplayName("connect: succes -> cree mapping en PENDING + appelle pushProperty + retourne le mapping final")
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
        when(mappingRepository.findById(saved.getId())).thenReturn(Optional.of(saved));
        when(syncService.pushProperty(anyLong(), anyLong(), any(), any()))
            .thenReturn(new ChannexSyncService.ChannexSyncResult(true, "ok", 180, 180));

        ChannexPropertyMapping result = service.connect(100L, 42L, request());

        assertThat(result.getChannexPropertyId()).isEqualTo("channex-prop-1");
        assertThat(result.getClenzyPropertyId()).isEqualTo(100L);
        verify(channexClient).getProperty("channex-prop-1");
        verify(mappingRepository).save(any());
        verify(syncService).pushProperty(eq(100L), eq(42L), any(), any());
    }

    @Test
    @DisplayName("connect: push initial echoue -> mapping reste cree (le scheduler retentera)")
    void connect_pushInitialFailsButMappingPersists() {
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property(100L, 42L)));
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.empty());
        when(channexClient.getProperty("channex-prop-1"))
            .thenReturn(new ChannexPropertyDto("channex-prop-1", "Studio", "EUR", null, "Europe/Paris"));

        ChannexPropertyMapping saved = new ChannexPropertyMapping();
        saved.setId(UUID.randomUUID());
        when(mappingRepository.save(any())).thenReturn(saved);
        when(mappingRepository.findById(saved.getId())).thenReturn(Optional.of(saved));
        when(syncService.pushProperty(anyLong(), anyLong(), any(), any()))
            .thenThrow(new RuntimeException("Channex temporairement down"));

        // Ne propage pas l'exception — le service log un warning et retourne le mapping
        ChannexPropertyMapping result = service.connect(100L, 42L, request());
        assertThat(result).isNotNull();
        verify(mappingRepository).save(any());
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
        when(mappingRepository.findById(saved.getId())).thenReturn(Optional.of(saved));
        when(syncService.pushProperty(anyLong(), anyLong(), any(), any()))
            .thenReturn(new ChannexSyncService.ChannexSyncResult(true, "ok", 180, 180));

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

    // ─── Tiny helper for ArgumentMatchers.eq ────────────────────────────────
    private static <T> T eq(T value) { return org.mockito.ArgumentMatchers.eq(value); }
}
