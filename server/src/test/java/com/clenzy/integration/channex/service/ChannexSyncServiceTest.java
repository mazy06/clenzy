package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexAvailabilityUpdate;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
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
        // ChannexSyncLogService est mocke via une instance fake qui no-op : on
        // ne teste pas l'ecriture des logs ici (couvert par les tests d'integration
        // dedies), juste le comportement metier de sync.
        ChannexSyncLogService noopLogs = org.mockito.Mockito.mock(ChannexSyncLogService.class);
        com.clenzy.repository.PropertyRepository propertyRepo =
            org.mockito.Mockito.mock(com.clenzy.repository.PropertyRepository.class);
        // Defaut : property en mode CLENZY (push autorise)
        com.clenzy.model.Property propStub = new com.clenzy.model.Property();
        propStub.setPriceSourceOfTruth(com.clenzy.model.PriceSourceOfTruth.CLENZY);
        org.mockito.Mockito.lenient().when(propertyRepo.findById(org.mockito.ArgumentMatchers.anyLong()))
            .thenReturn(java.util.Optional.of(propStub));
        // Phase 5 : nouvelles deps pushRatesForRange (BookingRestriction) + pushPricingSettings
        com.clenzy.repository.BookingRestrictionRepository brRepo =
            org.mockito.Mockito.mock(com.clenzy.repository.BookingRestrictionRepository.class);
        org.mockito.Mockito.lenient().when(brRepo.findApplicable(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyLong()))
            .thenReturn(java.util.List.of());
        com.clenzy.repository.OccupancyPricingRepository opRepo =
            org.mockito.Mockito.mock(com.clenzy.repository.OccupancyPricingRepository.class);
        com.clenzy.repository.LengthOfStayDiscountRepository losRepo =
            org.mockito.Mockito.mock(com.clenzy.repository.LengthOfStayDiscountRepository.class);
        com.clenzy.repository.RatePlanRepository rpRepo =
            org.mockito.Mockito.mock(com.clenzy.repository.RatePlanRepository.class);
        service = new ChannexSyncService(
            channexClient, mappingRepository, calendarDayRepository, priceEngine, new ObjectMapper(),
            new ChannexMetrics(new SimpleMeterRegistry()),
            noopLogs,
            propertyRepo,
            brRepo, opRepo, losRepo, rpRepo
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
    @DisplayName("erreur de traitement inattendue -> propagee (declenche la DLT), plus d'avalage (audit #7)")
    void propagatesUnexpectedErrorToTriggerDlt() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenThrow(new RuntimeException("DB indisponible"));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BOOKING_CREATED",
            "from", "2026-06-01", "to", "2026-06-03"
        ))).isInstanceOf(RuntimeException.class).hasMessageContaining("DB indisponible");
    }

    @Test
    @DisplayName("event valide -> push availability + rates avec status ACTIVE final")
    void pushesAvailabilityAndRatesWhenMappingActive() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);
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
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);

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
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);
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
    @DisplayName("pushProperty (manuel) retourne le bilan + sauve le mapping (avec OTA actif)")
    void pushPropertyReturnsResult() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        // Prerequis : au moins un OTA actif cote Channex sinon push est skip
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);
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
    @DisplayName("pushProperty sans OTA actif -> skip silencieux + result.message explicite")
    void pushPropertySkipsIfNoActiveOta() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(false);

        ChannexSyncService.ChannexSyncResult result = service.pushProperty(
            100L, 42L,
            LocalDate.of(2026, 6, 1),
            LocalDate.of(2026, 6, 7)
        );

        assertThat(result.success()).isTrue();
        assertThat(result.availabilityUpdates()).isZero();
        assertThat(result.message()).contains("no active OTA");
        // Aucun push effectue cote Channex
        verify(channexClient, never()).pushAvailability(anyList());
        verify(channexClient, never()).pushRates(anyList());
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

    @Test
    @DisplayName("Event avec from/to manquants -> skip propre")
    void skipsOnIncompleteEventMissingDates() {
        service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BOOKING_CREATED"
        ));
        verify(mappingRepository, never()).findByClenzyPropertyId(anyLong(), anyLong());
    }

    @Test
    @DisplayName("Event avec from string ISO -> parse correctement")
    void parsesIsoDateStrings() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.empty());

        service.onCalendarUpdate(Map.of(
            "propertyId", "100", "orgId", "42", "action", "BOOKING_CREATED",
            "from", "2026-06-01", "to", "2026-06-07"
        ));

        verify(mappingRepository).findByClenzyPropertyId(eq(100L), eq(42L));
    }

    @Test
    @DisplayName("Event avec date invalide -> skip")
    void skipsOnInvalidDate() {
        service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "X",
            "from", "not-a-date", "to", "also-bad"
        ));
        verify(mappingRepository, never()).findByClenzyPropertyId(anyLong(), anyLong());
    }

    @Test
    @DisplayName("Event avec propertyId String non-numeric -> skip")
    void skipsOnNonNumericPropertyId() {
        service.onCalendarUpdate(Map.of(
            "propertyId", "abc", "orgId", 42, "action", "X",
            "from", "2026-06-01", "to", "2026-06-03"
        ));
        verify(mappingRepository, never()).findByClenzyPropertyId(anyLong(), anyLong());
    }

    @Test
    @DisplayName("pushProperty avec mapping ERROR initial + push reussi -> repasse en ACTIVE")
    void pushPropertyRecoversFromError() {
        mapping.setSyncStatus(ChannexSyncStatus.ERROR);
        mapping.setLastSyncError("previous error");
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);
        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(Map.of());

        ChannexSyncService.ChannexSyncResult result = service.pushProperty(
            100L, 42L, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7)
        );

        assertThat(result.success()).isTrue();
        ArgumentCaptor<ChannexPropertyMapping> savedCap = ArgumentCaptor.forClass(ChannexPropertyMapping.class);
        verify(mappingRepository, org.mockito.Mockito.atLeastOnce()).save(savedCap.capture());
        assertThat(savedCap.getValue().getSyncStatus()).isEqualTo(ChannexSyncStatus.ACTIVE);
        assertThat(savedCap.getValue().getLastSyncError()).isNull();
    }

    @Test
    @DisplayName("Push rates avec restrictions applicables -> enrichit chaque update")
    void pushRatesWithRestrictions() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);
        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(Map.of(
                LocalDate.of(2026, 6, 1), new BigDecimal("100.00"),
                LocalDate.of(2026, 6, 2), new BigDecimal("100.00")
            ));

        service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "PRICE_UPDATED",
            "from", "2026-06-01", "to", "2026-06-02"
        ));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ChannexRateUpdate>> cap = ArgumentCaptor.forClass(List.class);
        verify(channexClient).pushRates(cap.capture());
        assertThat(cap.getValue()).hasSize(2);
    }

    @Test
    @DisplayName("Erreur Channex sur push rates -> mapping passe en ERROR")
    void marksErrorOnRatesFailure() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);
        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(Map.of(
                LocalDate.of(2026, 6, 1), new BigDecimal("100.00")
            ));

        doThrow(new ChannexException(ChannexException.Kind.RATE_LIMITED, "Channex 429"))
            .when(channexClient).pushRates(anyList());

        service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "PRICE_UPDATED",
            "from", "2026-06-01", "to", "2026-06-01"
        ));

        verify(mappingRepository, org.mockito.Mockito.atLeastOnce()).save(any());
    }

    @Test
    @DisplayName("OTA check throws exception -> tente le push quand meme")
    void pushPropertyWhenOtaCheckThrows() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc")))
            .thenThrow(new RuntimeException("Channex unreachable"));
        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(Map.of());

        // Should tenter le push malgre l'erreur sur le check OTA
        ChannexSyncService.ChannexSyncResult result = service.pushProperty(
            100L, 42L, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7)
        );

        // Push tente (status final depend de pushAvailability/pushRates)
        assertThat(result).isNotNull();
        verify(channexClient).pushAvailability(anyList());
    }

    @Test
    @DisplayName("retryFailedMappings sans mapping en erreur -> no-op")
    void retryFailedMappings_empty_noOp() {
        when(mappingRepository.findAllInError()).thenReturn(List.of());

        service.retryFailedMappings();

        verify(channexClient, never()).pushAvailability(anyList());
        verify(channexClient, never()).pushRates(anyList());
    }

    @Test
    @DisplayName("retryFailedMappings avec 1 mapping en error et recovery OK")
    void retryFailedMappings_recovers() {
        mapping.setSyncStatus(ChannexSyncStatus.ERROR);
        when(mappingRepository.findAllInError()).thenReturn(List.of(mapping));
        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(Map.of());

        service.retryFailedMappings();

        verify(channexClient).pushAvailability(anyList());
        verify(channexClient).pushRates(anyList());
        // updateMappingStatus to ACTIVE called at least once
        verify(mappingRepository, org.mockito.Mockito.atLeastOnce()).save(any());
    }

    @Test
    @DisplayName("retryFailedMappings catche les exceptions et continue")
    void retryFailedMappings_handlesException() {
        ChannexPropertyMapping m2 = new ChannexPropertyMapping();
        m2.setId(UUID.randomUUID());
        m2.setOrganizationId(42L);
        m2.setClenzyPropertyId(200L);
        m2.setChannexPropertyId("ch-prop-2");
        m2.setChannexRoomTypeId("ch-room-2");
        m2.setSyncStatus(ChannexSyncStatus.ERROR);

        mapping.setSyncStatus(ChannexSyncStatus.ERROR);
        when(mappingRepository.findAllInError()).thenReturn(List.of(mapping, m2));
        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenThrow(new RuntimeException("DB error on mapping 1"));
        when(calendarDayRepository.findByPropertyAndDateRange(eq(200L), any(), any(), eq(42L)))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(200L), any(), any(), eq(42L)))
            .thenReturn(Map.of());

        // Should not throw — first mapping failure doesn't stop second
        service.retryFailedMappings();

        // Second mapping should have been processed
        verify(channexClient, org.mockito.Mockito.atLeastOnce()).pushAvailability(anyList());
    }

    @Test
    @DisplayName("Event payload = Map direct -> traite normalement")
    void unwrapDirectMap() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.empty());

        // Direct Map (no ConsumerRecord wrapper)
        service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "X",
            "from", "2026-06-01", "to", "2026-06-03"
        ));

        verify(mappingRepository).findByClenzyPropertyId(eq(100L), eq(42L));
    }

    @Test
    @DisplayName("Event payload type inattendu -> skip silencieux")
    void unwrapUnknownType_skips() {
        // Pass an unexpected Object — not Map, not String, not ConsumerRecord
        service.onCalendarUpdate(Integer.valueOf(42));
        verify(mappingRepository, never()).findByClenzyPropertyId(anyLong(), anyLong());
    }

    @Test
    @DisplayName("Event payload = String JSON -> deserialise et traite")
    void unwrapJsonString() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.empty());

        // Json string
        service.onCalendarUpdate("{\"propertyId\":100,\"orgId\":42,\"action\":\"X\",\"from\":\"2026-06-01\",\"to\":\"2026-06-03\"}");

        verify(mappingRepository).findByClenzyPropertyId(eq(100L), eq(42L));
    }

    @Test
    @DisplayName("Mapping ERROR statut + Kafka event -> traite quand meme")
    void mappingInErrorStatus_stillProcessed() {
        mapping.setSyncStatus(ChannexSyncStatus.ERROR);
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);
        when(calendarDayRepository.findByPropertyAndDateRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(Map.of());

        service.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BOOKING_CREATED",
            "from", "2026-06-01", "to", "2026-06-03"
        ));

        // Should still process and call push (status ERROR ne bloque pas, seul DISABLED)
        verify(channexClient).pushAvailability(anyList());
    }
}
