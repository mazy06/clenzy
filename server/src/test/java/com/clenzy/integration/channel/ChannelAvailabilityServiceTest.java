package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ChannelAvailabilityServiceTest {

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 42L;
    private static final LocalDate FROM = LocalDate.of(2026, 8, 10);
    private static final LocalDate TO = LocalDate.of(2026, 8, 15);

    private ChannelConnectorRegistry connectorRegistry;
    private ChannelMappingRepository channelMappingRepository;
    private PropertyRepository propertyRepository;
    private OrganizationAccessGuard organizationAccessGuard;
    private ChannelSyncService channelSyncService;
    private ChannelConnector connector;
    private ChannelMapping mapping;

    private ChannelAvailabilityService service;

    @BeforeEach
    void setUp() {
        connectorRegistry = mock(ChannelConnectorRegistry.class);
        channelMappingRepository = mock(ChannelMappingRepository.class);
        propertyRepository = mock(PropertyRepository.class);
        organizationAccessGuard = mock(OrganizationAccessGuard.class);
        channelSyncService = mock(ChannelSyncService.class);
        connector = mock(ChannelConnector.class);
        mapping = mock(ChannelMapping.class);

        service = new ChannelAvailabilityService(connectorRegistry, channelMappingRepository,
                propertyRepository, organizationAccessGuard, channelSyncService);
    }

    private void stubHappyPath() {
        Property property = new Property();
        property.setOrganizationId(ORG_ID);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        when(mapping.getConnection()).thenReturn(mock(ChannelConnection.class));
        when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                .thenReturn(Optional.of(mapping));
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));
    }

    // ---- Validation de plage ----

    @Test
    void whenFromAfterTo_thenThrows() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                        TO, FROM, false));
        assertTrue(ex.getMessage().contains("dateFrom"));
        verifyNoInteractions(connectorRegistry);
    }

    @Test
    void whenRangeExceeds365Days_thenThrows() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                        FROM, FROM.plusDays(365), false));
        assertTrue(ex.getMessage().contains("365"));
        verifyNoInteractions(connectorRegistry);
    }

    @Test
    void whenRangeIsExactly365Days_thenAccepted() {
        stubHappyPath();
        when(connector.pushAvailabilityClosure(anyLong(), any(), any(), anyLong()))
                .thenReturn(SyncResult.success(365, 10L));

        SyncResult result = service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                FROM, FROM.plusDays(364), false);

        assertTrue(result.isSuccess());
    }

    @Test
    void whenDatesAreNull_thenThrows() {
        assertThrows(IllegalArgumentException.class,
                () -> service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                        null, TO, false));
        assertThrows(IllegalArgumentException.class,
                () -> service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                        FROM, null, false));
    }

    // ---- Ownership / canal ----

    @Test
    void whenPropertyUnknown_thenThrows() {
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                        FROM, TO, false));
        assertTrue(ex.getMessage().contains("introuvable"));
    }

    @Test
    void whenPropertyBelongsToAnotherOrg_thenAccessDenied() {
        Property property = new Property();
        property.setOrganizationId(999L);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        doThrow(new AccessDeniedException("Propriete hors de votre organisation"))
                .when(organizationAccessGuard)
                .requireSameOrganization(eq(999L), eq(ORG_ID), anyString());

        assertThrows(AccessDeniedException.class,
                () -> service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                        FROM, TO, false));
        verifyNoInteractions(connectorRegistry);
    }

    @Test
    void whenChannelNotConnected_thenThrows() {
        Property property = new Property();
        property.setOrganizationId(ORG_ID);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.BOOKING, ORG_ID))
                .thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.BOOKING,
                        FROM, TO, false));
        assertTrue(ex.getMessage().contains("non connecte"));
        verifyNoInteractions(connectorRegistry);
    }

    // ---- Mapping open/close → push connecteur ----

    @Test
    void whenClosing_thenPushesClosureWithExclusiveEndDate() {
        stubHappyPath();
        when(connector.pushAvailabilityClosure(PROPERTY_ID, FROM, TO.plusDays(1), ORG_ID))
                .thenReturn(SyncResult.success(6, 10L));

        SyncResult result = service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                FROM, TO, false);

        assertTrue(result.isSuccess());
        // dateTo INCLUSIVE cote metier → borne exclusive to+1 cote connecteur
        verify(connector).pushAvailabilityClosure(PROPERTY_ID, FROM, TO.plusDays(1), ORG_ID);
        verify(connector, never()).pushCalendarUpdate(anyLong(), any(), any(), anyLong());
        verify(channelSyncService).logSync(any(), eq(mapping), eq(SyncDirection.OUTBOUND),
                eq("CHANNEL_CLOSE"), eq(result));
    }

    @Test
    void whenOpening_thenRepushesCalendarTruth() {
        stubHappyPath();
        when(connector.pushCalendarUpdate(PROPERTY_ID, FROM, TO.plusDays(1), ORG_ID))
                .thenReturn(SyncResult.success(6, 10L));

        SyncResult result = service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                FROM, TO, true);

        assertTrue(result.isSuccess());
        verify(connector).pushCalendarUpdate(PROPERTY_ID, FROM, TO.plusDays(1), ORG_ID);
        verify(connector, never()).pushAvailabilityClosure(anyLong(), any(), any(), anyLong());
        verify(channelSyncService).logSync(any(), eq(mapping), eq(SyncDirection.OUTBOUND),
                eq("CHANNEL_OPEN"), eq(result));
    }

    @Test
    void whenConnectorMissing_thenThrows() {
        Property property = new Property();
        property.setOrganizationId(ORG_ID);
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property));
        when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                .thenReturn(Optional.of(mapping));
        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class,
                () -> service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                        FROM, TO, false));
    }

    // ---- Idempotence ----

    @Test
    void whenClosingTwice_thenBothPushesSucceedIdenticalArgs() {
        stubHappyPath();
        when(connector.pushAvailabilityClosure(PROPERTY_ID, FROM, TO.plusDays(1), ORG_ID))
                .thenReturn(SyncResult.success(6, 10L));

        SyncResult first = service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                FROM, TO, false);
        SyncResult second = service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                FROM, TO, false);

        // Re-pousser le meme etat = OK (aucun etat local, push stateless)
        assertTrue(first.isSuccess());
        assertTrue(second.isSuccess());
        verify(connector, times(2)).pushAvailabilityClosure(PROPERTY_ID, FROM, TO.plusDays(1), ORG_ID);
        verify(channelSyncService, times(2)).logSync(any(), eq(mapping), eq(SyncDirection.OUTBOUND),
                eq("CHANNEL_CLOSE"), any(SyncResult.class));
    }

    // ---- Le resultat du connecteur est transmis tel quel ----

    @Test
    void whenConnectorUnsupported_thenResultPropagated() {
        stubHappyPath();
        when(connector.pushAvailabilityClosure(anyLong(), any(), any(), anyLong()))
                .thenReturn(SyncResult.unsupported("Availability closure not supported by ICAL"));

        SyncResult result = service.setChannelAvailability(ORG_ID, PROPERTY_ID, ChannelName.AIRBNB,
                FROM, TO, false);

        assertEquals(SyncResult.Status.UNSUPPORTED, result.getStatus());
        verify(channelSyncService).logSync(any(), eq(mapping), eq(SyncDirection.OUTBOUND),
                eq("CHANNEL_CLOSE"), eq(result));
    }
}
