package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Phase B — evenements webhook additionnels : unmapped bookings (risque de
 * double reservation), rate_error/sync_warning, cycle de vie channel, Airbnb.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexChannelEventService")
class ChannexChannelEventServiceTest {

    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private ChannexSyncLogService syncLogService;
    @Mock private NotificationService notificationService;

    private ChannexChannelEventService service;
    private ChannexPropertyMapping mapping;

    @BeforeEach
    void setUp() {
        service = new ChannexChannelEventService(mappingRepository, syncLogService, notificationService);
        mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(42L);
        mapping.setClenzyPropertyId(100L);
        mapping.setChannexPropertyId("chx-1");
    }

    @Test
    @DisplayName("booking_unmapped_room -> sync log FAIL + notification ERROR avec deep-link diagnose")
    void unmappedBookingNotifiesAndLogs() {
        when(mappingRepository.findByChannexPropertyIdAnyOrg("chx-1"))
            .thenReturn(Optional.of(mapping));

        boolean handled = service.onUnmappedBooking("chx-1", "booking_unmapped_room");

        assertThat(handled).isTrue();
        verify(syncLogService).record(eq(42L), eq(100L), any(), any(), any(), anyInt(), any(),
            contains("room type non mappe"));
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(42L), eq(NotificationKey.CHANNEX_UNMAPPED_BOOKING), anyString(), anyString(),
            eq("/properties?diagnoseChannex=100"));
    }

    @Test
    @DisplayName("mapping introuvable -> false, aucune notification")
    void noMappingNoNotification() {
        when(mappingRepository.findByChannexPropertyIdAnyOrg("chx-unknown"))
            .thenReturn(Optional.empty());

        boolean handled = service.onUnmappedBooking("chx-unknown", "booking_unmapped_rate");

        assertThat(handled).isFalse();
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(
            anyLong(), any(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("property_id null -> false, pas de lookup")
    void nullPropertyIdSkips() {
        boolean handled = service.onRateError(null, "boom");

        assertThat(handled).isFalse();
        verify(mappingRepository, never()).findByChannexPropertyIdAnyOrg(any());
    }

    @Test
    @DisplayName("rate_error -> sync log FAIL + notification (sans flag ERROR du mapping)")
    void rateErrorLogsAndNotifies() {
        when(mappingRepository.findByChannexPropertyIdAnyOrg("chx-1"))
            .thenReturn(Optional.of(mapping));

        boolean handled = service.onRateError("chx-1", "price below min_price");

        assertThat(handled).isTrue();
        verify(syncLogService).record(eq(42L), eq(100L), any(), any(), any(), anyInt(), any(),
            contains("price below min_price"));
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(42L), eq(NotificationKey.CHANNEX_RATE_ERROR), anyString(), anyString(), anyString());
        // rate_error ne passe PAS le mapping en ERROR (la sync n'est pas morte)
        verify(mappingRepository, never()).save(any());
    }

    @Test
    @DisplayName("sync_warning -> notification WARNING, pas de sync log")
    void syncWarningNotifiesOnly() {
        when(mappingRepository.findByChannexPropertyIdAnyOrg("chx-1"))
            .thenReturn(Optional.of(mapping));

        boolean handled = service.onSyncWarning("chx-1", "minor divergence");

        assertThat(handled).isTrue();
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(42L), eq(NotificationKey.CHANNEX_SYNC_WARNING), anyString(),
            contains("minor divergence"), anyString());
        verify(syncLogService, never()).record(anyLong(), anyLong(), any(), any(), any(),
            anyInt(), any(), anyString());
    }

    @Test
    @DisplayName("disconnect_channel -> notification 'distribution arretee'")
    void disconnectChannelNotifiesCritical() {
        when(mappingRepository.findByChannexPropertyIdAnyOrg("chx-1"))
            .thenReturn(Optional.of(mapping));

        boolean handled = service.onChannelLifecycleEvent("chx-1", "disconnect_channel");

        assertThat(handled).isTrue();
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(42L), eq(NotificationKey.CHANNEX_CHANNEL_EVENT),
            contains("déconnecté"), contains("ARRÊTÉE"), anyString());
    }

    @Test
    @DisplayName("reservation_request Airbnb -> notification 'action requise'")
    void airbnbReservationRequestNotifiesActionRequired() {
        when(mappingRepository.findByChannexPropertyIdAnyOrg("chx-1"))
            .thenReturn(Optional.of(mapping));

        boolean handled = service.onAirbnbEvent("chx-1", "reservation_request");

        assertThat(handled).isTrue();
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(42L), eq(NotificationKey.CHANNEX_AIRBNB_REQUEST),
            contains("action requise"), contains("attend une réponse"), anyString());
    }

    @Test
    @DisplayName("notification KO -> best-effort, l'evenement reste traite (true)")
    void notificationFailureSwallowed() {
        when(mappingRepository.findByChannexPropertyIdAnyOrg("chx-1"))
            .thenReturn(Optional.of(mapping));
        doThrow(new RuntimeException("notif down")).when(notificationService)
            .notifyAdminsAndManagersByOrgId(anyLong(), any(), anyString(), anyString(), anyString());

        boolean handled = service.onAirbnbEvent("chx-1", "inquiry");

        assertThat(handled).isTrue();
    }
}
