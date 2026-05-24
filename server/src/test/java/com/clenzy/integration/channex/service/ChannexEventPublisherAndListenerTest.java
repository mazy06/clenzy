package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.event.ChannexPricingSettingsChangedEvent;
import com.clenzy.integration.channex.exception.ChannexException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests pour {@link ChannexPricingEventPublisher} et
 * {@link ChannexPricingSettingsAutoPushListener} — Phase 5 audit O3.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexPricingEventPublisher + AutoPushListener (Phase 5 O3)")
class ChannexEventPublisherAndListenerTest {

    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private ChannexSyncService syncService;
    @Mock private com.clenzy.integration.channex.config.ChannexProperties channexProperties;

    private ChannexPricingEventPublisher publisher;
    private ChannexPricingSettingsAutoPushListener listener;

    @BeforeEach
    void setUp() {
        publisher = new ChannexPricingEventPublisher(eventPublisher);
        listener = new ChannexPricingSettingsAutoPushListener(syncService, channexProperties);
    }

    // ─── Publisher ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("publish : args valides -> emet event avec source label")
    void publish_validEvent() {
        publisher.publish(100L, 42L, "WEEKEND_RATE_UPDATED");

        ArgumentCaptor<ChannexPricingSettingsChangedEvent> captor =
            ArgumentCaptor.forClass(ChannexPricingSettingsChangedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        ChannexPricingSettingsChangedEvent ev = captor.getValue();
        assertThat(ev.clenzyPropertyId()).isEqualTo(100L);
        assertThat(ev.organizationId()).isEqualTo(42L);
        assertThat(ev.source()).isEqualTo("WEEKEND_RATE_UPDATED");
    }

    @Test
    @DisplayName("publish : propertyId null -> skip (pas d'event emis)")
    void publish_skipNullProperty() {
        publisher.publish(null, 42L, "SOMETHING");
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    @DisplayName("publish : orgId null -> skip (pas d'event emis)")
    void publish_skipNullOrg() {
        publisher.publish(100L, null, "SOMETHING");
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    @DisplayName("publish : source null -> remplace par UNKNOWN")
    void publish_nullSourceReplaced() {
        publisher.publish(100L, 42L, null);

        ArgumentCaptor<ChannexPricingSettingsChangedEvent> captor =
            ArgumentCaptor.forClass(ChannexPricingSettingsChangedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().source()).isEqualTo("UNKNOWN");
    }

    // ─── Listener ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("listener : event valide + API key OK -> appelle pushPricingSettings")
    void listener_callsSyncService() {
        when(channexProperties.isConfigured()).thenReturn(true);
        when(syncService.pushPricingSettings(100L, 42L))
            .thenReturn(new ChannexSyncService.ChannexSyncResult(true, "ok", 5, 0));

        listener.onPricingSettingsChanged(new ChannexPricingSettingsChangedEvent(
            100L, 42L, "WEEKEND_RATE_UPDATED"));

        verify(syncService).pushPricingSettings(100L, 42L);
    }

    @Test
    @DisplayName("listener : event null -> no-op silencieux")
    void listener_nullEvent_silentSkip() {
        listener.onPricingSettingsChanged(null);
        verify(syncService, never()).pushPricingSettings(anyLong(), anyLong());
    }

    @Test
    @DisplayName("listener : propertyId null dans event -> skip (event invalide)")
    void listener_nullPropertyId() {
        listener.onPricingSettingsChanged(new ChannexPricingSettingsChangedEvent(
            null, 42L, "X"));
        verify(syncService, never()).pushPricingSettings(anyLong(), anyLong());
    }

    @Test
    @DisplayName("listener : CHANNEX_API_KEY non configuree -> skip sans appel syncService")
    void listener_apiKeyNotConfigured() {
        when(channexProperties.isConfigured()).thenReturn(false);

        listener.onPricingSettingsChanged(new ChannexPricingSettingsChangedEvent(
            100L, 42L, "TEST"));

        verify(syncService, never()).pushPricingSettings(anyLong(), anyLong());
    }

    @Test
    @DisplayName("listener : pushPricingSettings throw -> capture l'exception (best-effort)")
    void listener_swallowsException() {
        when(channexProperties.isConfigured()).thenReturn(true);
        when(syncService.pushPricingSettings(anyLong(), anyLong()))
            .thenThrow(new ChannexException(ChannexException.Kind.SERVER_ERROR, "503"));

        // Aucune exception ne doit remonter (best-effort async)
        listener.onPricingSettingsChanged(new ChannexPricingSettingsChangedEvent(
            100L, 42L, "TEST"));

        verify(syncService).pushPricingSettings(100L, 42L);
    }

    @Test
    @DisplayName("listener : pushPricingSettings retourne success=false -> log mais pas d'exception")
    void listener_handlesFailedResult() {
        when(channexProperties.isConfigured()).thenReturn(true);
        when(syncService.pushPricingSettings(anyLong(), anyLong()))
            .thenReturn(new ChannexSyncService.ChannexSyncResult(false, "skipped", 0, 0));

        listener.onPricingSettingsChanged(new ChannexPricingSettingsChangedEvent(
            100L, 42L, "TEST"));

        verify(syncService).pushPricingSettings(100L, 42L);
    }
}
