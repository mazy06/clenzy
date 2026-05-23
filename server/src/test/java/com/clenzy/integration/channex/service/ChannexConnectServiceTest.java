package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexConnectRequest;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
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
        return new ChannexConnectRequest("channex-prop-1", "channex-room-1", "channex-rate-1");
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
