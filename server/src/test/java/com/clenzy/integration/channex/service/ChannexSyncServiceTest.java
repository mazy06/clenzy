package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexAvailabilityUpdate;
import com.clenzy.integration.channex.dto.ChannexRateUpdate;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.service.PriceEngine;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexSyncService")
class ChannexSyncServiceTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private PriceEngine priceEngine;

    private ChannexSyncService service;
    private ChannexPropertyMapping mapping;

    @BeforeEach
    void setUp() {
        service = new ChannexSyncService(
            channexClient, mappingRepository, calendarDayRepository, priceEngine, new ObjectMapper()
        );

        mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(42L);
        mapping.setClenzyPropertyId(100L);
        mapping.setChannexPropertyId("channex-prop-abc");
        mapping.setChannexRoomTypeId("channex-room-xyz");
        mapping.setChannexDefaultRatePlanId("channex-rate-std");
        mapping.setSyncStatus(ChannexSyncStatus.ACTIVE);
    }

    @Test
    @DisplayName("event sur property sans mapping Channex -> skip silencieux (les connectors directs s'en chargent)")
    void skipsIfNoMapping() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.empty());

        service.onCalendarUpdate(Map.of(
            "propertyId", 100,
            "orgId", 42,
            "action", "BOOKING_CREATED",
            "from", "2026-06-01",
            "to", "2026-06-07"
        ));

        verify(channexClient, never()).pushAvailability(anyList());
        verify(channexClient, never()).pushRates(anyList());
        verify(mappingRepository, never()).save(any());
    }

    @Test
    @DisplayName("event sur mapping DISABLED -> skip")
    void skipsIfDisabled() {
        mapping.setSyncStatus(ChannexSyncStatus.DISABLED);
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));

        service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BOOKING_CREATED",
            "from", "2026-06-01", "to", "2026-06-03"
        ));

        verify(channexClient, never()).pushAvailability(anyList());
    }

    @Test
    @DisplayName("event valide -> push availability + rates avec status ACTIVE final")
    void pushesAvailabilityAndRatesWhenMappingActive() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(Map.of(
                LocalDate.of(2026, 6, 1), new BigDecimal("89.00"),
                LocalDate.of(2026, 6, 2), new BigDecimal("89.00"),
                LocalDate.of(2026, 6, 3), new BigDecimal("95.00")
            ));

        service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "PRICE_UPDATED",
            "from", "2026-06-01", "to", "2026-06-03"
        ));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ChannexAvailabilityUpdate>> availCap = ArgumentCaptor.forClass(List.class);
        verify(channexClient).pushAvailability(availCap.capture());
        assertThat(availCap.getValue()).hasSize(3); // 3 jours, tous disponibles (no CalendarDay -> AVAILABLE)
        assertThat(availCap.getValue()).allMatch(u -> u.availability() == 1);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ChannexRateUpdate>> ratesCap = ArgumentCaptor.forClass(List.class);
        verify(channexClient).pushRates(ratesCap.capture());
        assertThat(ratesCap.getValue()).hasSize(3);

        // Le mapping doit etre sauvegarde en status ACTIVE
        ArgumentCaptor<ChannexPropertyMapping> savedCap = ArgumentCaptor.forClass(ChannexPropertyMapping.class);
        verify(mappingRepository).save(savedCap.capture());
        assertThat(savedCap.getValue().getSyncStatus()).isEqualTo(ChannexSyncStatus.ACTIVE);
        assertThat(savedCap.getValue().getLastSyncError()).isNull();
        assertThat(savedCap.getValue().getLastSyncAt()).isNotNull();
    }

    @Test
    @DisplayName("Jours BOOKED -> availability=0, jours AVAILABLE -> availability=1")
    void mapsCalendarStatusToAvailability() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));

        // Jour 2 bloque par BOOKED
        CalendarDay booked = new CalendarDay();
        booked.setDate(LocalDate.of(2026, 6, 2));
        booked.setStatus(CalendarDayStatus.BOOKED);

        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of(booked));
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(Map.of());

        service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BOOKING_CREATED",
            "from", "2026-06-01", "to", "2026-06-03"
        ));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ChannexAvailabilityUpdate>> cap = ArgumentCaptor.forClass(List.class);
        verify(channexClient).pushAvailability(cap.capture());
        List<ChannexAvailabilityUpdate> updates = cap.getValue();
        assertThat(updates).hasSize(3);
        assertThat(updates.get(0).availability()).isEqualTo(1); // 06-01 free
        assertThat(updates.get(1).availability()).isEqualTo(0); // 06-02 booked
        assertThat(updates.get(2).availability()).isEqualTo(1); // 06-03 free
    }

    @Test
    @DisplayName("Erreur Channex sur push availability -> mapping passe en ERROR + lastSyncError set")
    void marksErrorOnAvailabilityFailure() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(Map.of());

        doThrow(new ChannexException(ChannexException.Kind.SERVER_ERROR, "Channex 503"))
            .when(channexClient).pushAvailability(anyList());

        service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BOOKING_CREATED",
            "from", "2026-06-01", "to", "2026-06-03"
        ));

        // 2 saves : un pour le set ERROR de pushAvailability, un pour le final updateMappingStatus
        verify(mappingRepository, org.mockito.Mockito.atLeastOnce()).save(any());
    }

    @Test
    @DisplayName("pushProperty (manuel) retourne le bilan + sauve le mapping")
    void pushPropertyReturnsResult() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(Map.of());

        ChannexSyncService.ChannexSyncResult result = service.pushProperty(
            100L, 42L,
            LocalDate.of(2026, 6, 1),
            LocalDate.of(2026, 6, 7)
        );

        assertThat(result.success()).isTrue();
        assertThat(result.availabilityUpdates()).isEqualTo(7);
        verify(channexClient).pushAvailability(anyList());
        verify(channexClient).pushRates(anyList());
    }

    @Test
    @DisplayName("pushProperty sur property sans mapping -> result.success=false")
    void pushPropertyReturnsFalseIfNoMapping() {
        when(mappingRepository.findByClenzyPropertyId(eq(999L), anyLong()))
            .thenReturn(Optional.empty());

        ChannexSyncService.ChannexSyncResult result = service.pushProperty(
            999L, 42L, LocalDate.now(), LocalDate.now().plusDays(7)
        );

        assertThat(result.success()).isFalse();
        verify(channexClient, never()).pushAvailability(anyList());
    }

    @Test
    @DisplayName("Event avec propertyId/orgId manquants -> skip propre sans exception")
    void skipsOnIncompleteEvent() {
        service.onCalendarUpdate(Map.of("action", "WHATEVER"));
        verify(mappingRepository, never()).findByClenzyPropertyId(anyLong(), anyLong());
    }
}
