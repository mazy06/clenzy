package com.clenzy.integration.booking.service;

import com.clenzy.integration.booking.config.BookingConfig;
import com.clenzy.integration.booking.dto.BookingReservationDto;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link BookingSyncScheduler}.
 * Validates per-connection polling, reservation acknowledgement, and error isolation.
 */
@ExtendWith(MockitoExtension.class)
class BookingSyncSchedulerTest {

    @Mock private BookingConfig config;
    @Mock private BookingConnectionRepository connectionRepository;
    @Mock private BookingApiClient bookingApiClient;
    @Mock private BookingReservationService reservationService;

    private BookingSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new BookingSyncScheduler(
                config, connectionRepository, bookingApiClient, reservationService);
    }

    private BookingConnection createConnection(Long orgId, String hotelId,
                                                BookingConnection.BookingConnectionStatus status) {
        BookingConnection connection = new BookingConnection();
        connection.setId(orgId);
        connection.setOrganizationId(orgId);
        connection.setHotelId(hotelId);
        connection.setStatus(status);
        return connection;
    }

    private BookingReservationDto createReservation(String reservationId, String hotelId) {
        return new BookingReservationDto(
                reservationId, hotelId, "room-1",
                "Jane Doe", "jane@example.com", "+33611223344",
                LocalDate.now().plusDays(5), LocalDate.now().plusDays(7),
                "NEW", BigDecimal.valueOf(150), "EUR",
                2, null, null, "FR", "2026-05-30T10:00:00");
    }

    @Nested
    @DisplayName("pollReservations")
    class PollReservations {

        @Test
        void whenNoActiveConnections_thenDoesNothing() {
            when(connectionRepository.findAllActive()).thenReturn(List.of());

            scheduler.pollReservations();

            verify(bookingApiClient, never()).getReservations(anyString(), any());
            verify(reservationService, never()).handleReservationCreated(anyString(), anyMap());
        }

        @Test
        void whenConnectionHasNoReservations_thenStillUpdatesLastSyncAt() {
            BookingConnection conn = createConnection(1L, "hotel-1",
                    BookingConnection.BookingConnectionStatus.ACTIVE);
            conn.setErrorMessage("previous");
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(bookingApiClient.getReservations(eq("hotel-1"), any())).thenReturn(List.of());

            scheduler.pollReservations();

            ArgumentCaptor<BookingConnection> captor = ArgumentCaptor.forClass(BookingConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getLastSyncAt()).isNotNull();
            assertThat(captor.getValue().getErrorMessage()).isNull();
        }

        @Test
        void whenConnectionHasReservations_thenHandlesAndAcknowledgesEach() {
            BookingConnection conn = createConnection(1L, "hotel-1",
                    BookingConnection.BookingConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(bookingApiClient.getReservations(eq("hotel-1"), any()))
                    .thenReturn(List.of(
                            createReservation("R1", "hotel-1"),
                            createReservation("R2", "hotel-1")));

            scheduler.pollReservations();

            verify(reservationService, times(2)).handleReservationCreated(eq("hotel-1"), anyMap());
            verify(bookingApiClient).acknowledgeReservation("R1");
            verify(bookingApiClient).acknowledgeReservation("R2");
            verify(connectionRepository).save(any(BookingConnection.class));
        }

        @Test
        void whenReservationProcessingThrows_thenContinuesWithOthers() {
            BookingConnection conn = createConnection(1L, "hotel-1",
                    BookingConnection.BookingConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(bookingApiClient.getReservations(eq("hotel-1"), any()))
                    .thenReturn(List.of(
                            createReservation("R1", "hotel-1"),
                            createReservation("R2", "hotel-1")));
            doThrow(new RuntimeException("kafka unavailable"))
                    .when(reservationService).handleReservationCreated(anyString(), anyMap());

            scheduler.pollReservations();

            // Both attempted, ack never reached because handle threw before ack
            verify(reservationService, times(2)).handleReservationCreated(eq("hotel-1"), anyMap());
            verify(bookingApiClient, never()).acknowledgeReservation(anyString());
            // Connection still saved with lastSyncAt update
            verify(connectionRepository).save(any(BookingConnection.class));
        }

        @Test
        void whenPollingApiCallFails_thenSavesErrorMessage() {
            BookingConnection conn = createConnection(1L, "hotel-1",
                    BookingConnection.BookingConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(bookingApiClient.getReservations(eq("hotel-1"), any()))
                    .thenThrow(new RuntimeException("Booking XML unreachable"));

            scheduler.pollReservations();

            ArgumentCaptor<BookingConnection> captor = ArgumentCaptor.forClass(BookingConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getErrorMessage()).contains("Booking XML unreachable");
        }

        @Test
        void whenMultipleConnections_thenIsolatesErrors() {
            BookingConnection ok = createConnection(1L, "hotel-1",
                    BookingConnection.BookingConnectionStatus.ACTIVE);
            BookingConnection fail = createConnection(2L, "hotel-2",
                    BookingConnection.BookingConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(ok, fail));
            when(bookingApiClient.getReservations(eq("hotel-1"), any())).thenReturn(List.of());
            when(bookingApiClient.getReservations(eq("hotel-2"), any()))
                    .thenThrow(new RuntimeException("boom"));

            scheduler.pollReservations();

            verify(connectionRepository, times(2)).save(any(BookingConnection.class));
        }

        @Test
        void whenLastSyncAtSet_thenStartsFromThatDate() {
            BookingConnection conn = createConnection(1L, "hotel-1",
                    BookingConnection.BookingConnectionStatus.ACTIVE);
            LocalDateTime lastSync = LocalDateTime.now().minusDays(2);
            conn.setLastSyncAt(lastSync);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(bookingApiClient.getReservations(eq("hotel-1"), any())).thenReturn(List.of());

            scheduler.pollReservations();

            ArgumentCaptor<LocalDate> sinceCaptor = ArgumentCaptor.forClass(LocalDate.class);
            verify(bookingApiClient).getReservations(eq("hotel-1"), sinceCaptor.capture());
            assertThat(sinceCaptor.getValue()).isEqualTo(lastSync.toLocalDate());
        }
    }
}
