package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Le listener Kafka ne pousse RIEN vers l'API : il parse l'event, verifie le
 * mapping (1 lecture DB) et enfile la plage dans {@link ChannexAriBatcher}
 * (batching + rate limits = exigence de certification Channex).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexCalendarUpdateListener")
class ChannexCalendarUpdateListenerTest {

    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private ChannexAriBatcher ariBatcher;

    private ChannexCalendarUpdateListener listener;
    private ChannexPropertyMapping mapping;

    @BeforeEach
    void setUp() {
        listener = new ChannexCalendarUpdateListener(
            mappingRepository, ariBatcher, new ObjectMapper());

        mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(42L);
        mapping.setClenzyPropertyId(100L);
        mapping.setChannexPropertyId("channex-prop-abc");
        mapping.setSyncStatus(ChannexSyncStatus.ACTIVE);
    }

    @Test
    @DisplayName("event valide + mapping actif -> enqueue dans le batcher (pas d'appel API)")
    void enqueuesWhenMappingActive() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));

        listener.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "PRICE_UPDATED",
            "from", "2026-06-01", "to", "2026-06-03"
        ));

        verify(ariBatcher).enqueue(100L, 42L,
            LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-03"));
    }

    @Test
    @DisplayName("property sans mapping -> pas d'enqueue (connectors directs)")
    void skipsWhenNoMapping() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.empty());

        listener.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BOOKING_CREATED",
            "from", "2026-06-01", "to", "2026-06-07"
        ));

        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("mapping DISABLED -> pas d'enqueue")
    void skipsWhenDisabled() {
        mapping.setSyncStatus(ChannexSyncStatus.DISABLED);
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));

        listener.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BOOKING_CREATED",
            "from", "2026-06-01", "to", "2026-06-03"
        ));

        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("Event avec propertyId/orgId manquants -> skip propre sans exception")
    void skipsOnIncompleteEvent() {
        listener.onCalendarUpdate(Map.of("action", "WHATEVER"));
        verify(mappingRepository, never()).findByClenzyPropertyId(anyLong(), anyLong());
        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("Event avec from/to manquants -> skip propre")
    void skipsOnIncompleteEventMissingDates() {
        listener.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BOOKING_CREATED"
        ));
        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("Event avec ids String ISO -> parse correctement")
    void parsesIsoDateStrings() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));

        listener.onCalendarUpdate(Map.of(
            "propertyId", "100", "orgId", "42", "action", "BOOKING_CREATED",
            "from", "2026-06-01", "to", "2026-06-07"
        ));

        verify(ariBatcher).enqueue(100L, 42L,
            LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-07"));
    }

    @Test
    @DisplayName("Event avec date invalide -> skip")
    void skipsOnInvalidDate() {
        listener.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "X",
            "from", "not-a-date", "to", "also-bad"
        ));
        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("Event avec propertyId String non-numeric -> skip")
    void skipsOnNonNumericPropertyId() {
        listener.onCalendarUpdate(Map.of(
            "propertyId", "abc", "orgId", 42, "action", "X",
            "from", "2026-06-01", "to", "2026-06-03"
        ));
        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("Event payload type inattendu -> skip silencieux")
    void unwrapUnknownType_skips() {
        listener.onCalendarUpdate(Integer.valueOf(42));
        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any());
    }

    @Test
    @DisplayName("Event payload = String JSON -> deserialise et traite")
    void unwrapJsonString() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));

        listener.onCalendarUpdate(
            "{\"propertyId\":100,\"orgId\":42,\"action\":\"X\",\"from\":\"2026-06-01\",\"to\":\"2026-06-03\"}");

        verify(ariBatcher).enqueue(100L, 42L,
            LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-03"));
    }

    @Test
    @DisplayName("Payload JSON illisible -> propage (retry Kafka -> DLT, audit #7)")
    void malformedJsonPropagates() {
        assertThatThrownBy(() -> listener.onCalendarUpdate("{ broken"))
            .isInstanceOf(IllegalStateException.class);
    }
}
