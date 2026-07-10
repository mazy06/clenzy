package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexBookingDto;
import com.clenzy.model.Reservation;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Flux primaire bookings (doc Channex / certification test n°11) :
 * feed → persistance → ack PAR REVISION, jamais d'ack sans persistance.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexBookingFeedService")
class ChannexBookingFeedServiceTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexBookingService bookingService;

    // JavaTimeModule : comme l'ObjectMapper Spring injecte en prod (LocalDate).
    private final ObjectMapper objectMapper = new ObjectMapper()
        .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
    private ChannexBookingFeedService feedService;

    @BeforeEach
    void setUp() {
        feedService = new ChannexBookingFeedService(channexClient, bookingService,
            new ChannexMetrics(new SimpleMeterRegistry()), objectMapper);
    }

    private JsonNode revision(String revisionId, String bookingId, String status) {
        try {
            return objectMapper.readTree("""
                {
                  "id": "%s",
                  "type": "booking_revision",
                  "attributes": {
                    "id": "%s",
                    "booking_id": "%s",
                    "property_id": "channex-prop-1",
                    "status": "%s",
                    "arrival_date": "2026-08-01",
                    "departure_date": "2026-08-05",
                    "amount": "480.00",
                    "currency": "EUR"
                  }
                }
                """.formatted(revisionId, revisionId, bookingId, status));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    @DisplayName("revision 'new' -> handleNewBooking PUIS ack (ordre strict)")
    void processesNewRevisionThenAcks() {
        when(channexClient.fetchBookingRevisionsFeed(anyInt()))
            .thenReturn(List.of(revision("rev-1", "book-1", "new")))
            .thenReturn(List.of());
        when(bookingService.handleNewBooking(any())).thenReturn(new Reservation());

        var result = feedService.processFeed();

        assertThat(result.processed()).isEqualTo(1);
        assertThat(result.acked()).isEqualTo(1);
        assertThat(result.failed()).isZero();
        var order = inOrder(bookingService, channexClient);
        order.verify(bookingService).handleNewBooking(any());
        order.verify(channexClient).ackBookingRevision("rev-1");
    }

    @Test
    @DisplayName("le DTO transmis porte booking_id -> stableBookingId != id de revision")
    void dtoCarriesStableBookingId() {
        when(channexClient.fetchBookingRevisionsFeed(anyInt()))
            .thenReturn(List.of(revision("rev-9", "book-42", "new")))
            .thenReturn(List.of());
        when(bookingService.handleNewBooking(any())).thenReturn(new Reservation());

        feedService.processFeed();

        var captor = org.mockito.ArgumentCaptor.forClass(ChannexBookingDto.class);
        verify(bookingService).handleNewBooking(captor.capture());
        assertThat(captor.getValue().stableBookingId()).isEqualTo("book-42");
    }

    @Test
    @DisplayName("statuts modified/cancelled -> dispatch vers les bons handlers")
    void dispatchesByStatus() {
        when(channexClient.fetchBookingRevisionsFeed(anyInt()))
            .thenReturn(List.of(
                revision("rev-m", "book-1", "modified"),
                revision("rev-c", "book-2", "cancelled")))
            .thenReturn(List.of());

        var result = feedService.processFeed();

        assertThat(result.acked()).isEqualTo(2);
        verify(bookingService).handleModification(any());
        verify(bookingService).handleCancellation(any());
        verify(channexClient).ackBookingRevision("rev-m");
        verify(channexClient).ackBookingRevision("rev-c");
    }

    @Test
    @DisplayName("persistance KO -> PAS d'ack (la revision sera re-servie)")
    void doesNotAckOnPersistFailure() {
        when(channexClient.fetchBookingRevisionsFeed(anyInt()))
            .thenReturn(List.of(revision("rev-1", "book-1", "new")));
        when(bookingService.handleNewBooking(any()))
            .thenThrow(new IllegalStateException("mapping absent"));

        var result = feedService.processFeed();

        assertThat(result.acked()).isZero();
        assertThat(result.failed()).isEqualTo(1);
        verify(channexClient, never()).ackBookingRevision(any());
    }

    @Test
    @DisplayName("ack KO apres persistance -> compte en echec, re-tente au prochain passage")
    void ackFailureCountsAsFailed() {
        when(channexClient.fetchBookingRevisionsFeed(anyInt()))
            .thenReturn(List.of(revision("rev-1", "book-1", "new")));
        when(bookingService.handleNewBooking(any())).thenReturn(new Reservation());
        doThrow(new RuntimeException("Channex 503"))
            .when(channexClient).ackBookingRevision("rev-1");

        var result = feedService.processFeed();

        assertThat(result.acked()).isZero();
        assertThat(result.failed()).isEqualTo(1);
    }

    @Test
    @DisplayName("une revision en echec ne bloque pas les suivantes de la page")
    void failureDoesNotBlockOthers() {
        when(channexClient.fetchBookingRevisionsFeed(anyInt()))
            .thenReturn(List.of(
                revision("rev-bad", "book-1", "new"),
                revision("rev-ok", "book-2", "new")))
            .thenReturn(List.of());
        when(bookingService.handleNewBooking(any()))
            .thenThrow(new IllegalStateException("boom"))
            .thenReturn(new Reservation());

        var result = feedService.processFeed();

        assertThat(result.acked()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(1);
        verify(channexClient).ackBookingRevision("rev-ok");
        verify(channexClient, never()).ackBookingRevision("rev-bad");
    }

    @Test
    @DisplayName("feed vide -> passage a vide sans erreur")
    void emptyFeedNoop() {
        when(channexClient.fetchBookingRevisionsFeed(anyInt())).thenReturn(List.of());

        var result = feedService.processFeed();

        assertThat(result.processed()).isZero();
        verify(bookingService, never()).handleNewBooking(any());
    }

    @Test
    @DisplayName("lecture du feed KO -> passage interrompu proprement (0 traite)")
    void feedFetchErrorHandled() {
        when(channexClient.fetchBookingRevisionsFeed(anyInt()))
            .thenThrow(new RuntimeException("Channex down"));

        var result = feedService.processFeed();

        assertThat(result.processed()).isZero();
        verify(bookingService, never()).handleNewBooking(any());
    }

    @Test
    @DisplayName("revision illisible (attributes manquants) -> echec, pas d'ack")
    void unparseableRevisionNotAcked() throws Exception {
        JsonNode broken = objectMapper.readTree(
            "{\"id\":\"rev-x\",\"attributes\":{\"arrival_date\":\"not-a-date\"}}");
        when(channexClient.fetchBookingRevisionsFeed(anyInt()))
            .thenReturn(List.of(broken));

        var result = feedService.processFeed();

        assertThat(result.failed()).isEqualTo(1);
        verify(channexClient, never()).ackBookingRevision(any());
    }
}
