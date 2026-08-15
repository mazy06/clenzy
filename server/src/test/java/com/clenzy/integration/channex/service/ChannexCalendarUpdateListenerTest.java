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

        // La portee voyage avec l'event : PRICE_UPDATED ne concerne que les tarifs.
        // Et les CHAMPS aussi : un changement de prix ne porte QUE le prix. Envoyer
        // les sept champs donnait un instantane la ou Channex attend un delta
        // (« snapshot-based update rather than a rate-only delta », 2026-08-15).
        verify(ariBatcher).enqueue(100L, 42L,
            LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-03"),
            com.clenzy.integration.channex.model.ChannexAriScope.RATES,
            java.util.Set.of(com.clenzy.integration.channex.model.ChannexRateField.RATE));
    }

    @Test
    @DisplayName("BLOCKED -> tarifs, et le payload ne porte QUE stop_sell")
    void blockedCarriesOnlyStopSell() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));

        listener.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BLOCKED",
            "from", "2027-02-10", "to", "2027-02-10"
        ));

        // Un blocage ferme la vente sans toucher au prix ni aux restrictions.
        // « Stop sell update also carries other fields [...]; it should contain
        // only stop sell » — certification du 2026-08-15.
        verify(ariBatcher).enqueue(100L, 42L,
            LocalDate.parse("2027-02-10"), LocalDate.parse("2027-02-10"),
            com.clenzy.integration.channex.model.ChannexAriScope.RATES,
            java.util.Set.of(com.clenzy.integration.channex.model.ChannexRateField.STOP_SELL));
    }

    @Test
    @DisplayName("RESTRICTION_UPDATED -> les quatre champs de restriction, sans prix ni stop_sell")
    void restrictionCarriesOnlyRestrictionFields() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));

        listener.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "RESTRICTION_UPDATED",
            "from", "2027-03-12", "to", "2027-03-12"
        ));

        // Le service filtrera ensuite sur les champs NON NULS de la restriction :
        // c'est ce qui distingue « sejour minimum seul » de « restrictions
        // combinees » sans que l'action ait a le dire.
        verify(ariBatcher).enqueue(100L, 42L,
            LocalDate.parse("2027-03-12"), LocalDate.parse("2027-03-12"),
            com.clenzy.integration.channex.model.ChannexAriScope.RATES,
            com.clenzy.integration.channex.model.ChannexRateField.RESTRICTION_FIELDS);
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

        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any(), any(), any());
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

        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Event avec propertyId/orgId manquants -> skip propre sans exception")
    void skipsOnIncompleteEvent() {
        listener.onCalendarUpdate(Map.of("action", "WHATEVER"));
        verify(mappingRepository, never()).findByClenzyPropertyId(anyLong(), anyLong());
        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Event avec from/to manquants -> skip propre")
    void skipsOnIncompleteEventMissingDates() {
        listener.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "BOOKING_CREATED"
        ));
        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any(), any(), any());
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
            LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-07"),
            com.clenzy.integration.channex.model.ChannexAriScope.BOTH,
            com.clenzy.integration.channex.model.ChannexRateField.ALL);
    }

    @Test
    @DisplayName("Event avec date invalide -> skip")
    void skipsOnInvalidDate() {
        listener.onCalendarUpdate(Map.of(
            "propertyId", 100, "orgId", 42, "action", "X",
            "from", "not-a-date", "to", "also-bad"
        ));
        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Event avec propertyId String non-numeric -> skip")
    void skipsOnNonNumericPropertyId() {
        listener.onCalendarUpdate(Map.of(
            "propertyId", "abc", "orgId", 42, "action", "X",
            "from", "2026-06-01", "to", "2026-06-03"
        ));
        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Event payload type inattendu -> skip silencieux")
    void unwrapUnknownType_skips() {
        listener.onCalendarUpdate(Integer.valueOf(42));
        verify(ariBatcher, never()).enqueue(anyLong(), anyLong(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Event payload = String JSON -> deserialise et traite")
    void unwrapJsonString() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping));

        listener.onCalendarUpdate(
            "{\"propertyId\":100,\"orgId\":42,\"action\":\"X\",\"from\":\"2026-06-01\",\"to\":\"2026-06-03\"}");

        verify(ariBatcher).enqueue(100L, 42L,
            LocalDate.parse("2026-06-01"), LocalDate.parse("2026-06-03"),
            com.clenzy.integration.channex.model.ChannexAriScope.BOTH,
            com.clenzy.integration.channex.model.ChannexRateField.ALL);
    }

    @Test
    @DisplayName("Payload JSON illisible -> propage (retry Kafka -> DLT, audit #7)")
    void malformedJsonPropagates() {
        assertThatThrownBy(() -> listener.onCalendarUpdate("{ broken"))
            .isInstanceOf(IllegalStateException.class);
    }
}
