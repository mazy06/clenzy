package com.clenzy.integration.google.service;

import com.clenzy.integration.google.config.GoogleVacationRentalsConfig;
import com.clenzy.integration.google.dto.GoogleVrBookingDto;
import com.clenzy.integration.google.model.GoogleVrConnection;
import com.clenzy.integration.google.repository.GoogleVrConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GoogleVrSyncServiceTest {

    @Mock private GoogleVacationRentalsConfig config;
    @Mock private GoogleVrApiClient apiClient;
    @Mock private GoogleVrConnectionRepository connectionRepository;

    private GoogleVrSyncService service;

    @BeforeEach
    void setUp() {
        service = new GoogleVrSyncService(config, apiClient, connectionRepository);
    }

    private GoogleVrConnection activeConnection() {
        GoogleVrConnection conn = new GoogleVrConnection(1L, "partner-1");
        conn.setStatus(GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE);
        return conn;
    }

    @Test
    void pushAvailabilityAndRates_noConnection_returnsMinus1() {
        when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

        int result = service.pushAvailabilityAndRates(1L, LocalDate.now(), LocalDate.now().plusDays(7));

        assertEquals(-1, result);
        verify(apiClient, never()).pushAvailability(any(), any());
    }

    @Test
    void pushAvailabilityAndRates_inactiveConnection_returnsMinus1() {
        GoogleVrConnection conn = new GoogleVrConnection(1L, "p");
        conn.setStatus(GoogleVrConnection.GoogleVrConnectionStatus.INACTIVE);
        when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.of(conn));

        int result = service.pushAvailabilityAndRates(1L, LocalDate.now(), LocalDate.now().plusDays(1));

        assertEquals(-1, result);
    }

    @Test
    void pushAvailabilityAndRates_activeConnection_callsApiAndUpdatesLastSync() {
        GoogleVrConnection conn = activeConnection();
        when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.of(conn));

        int result = service.pushAvailabilityAndRates(1L, LocalDate.now(), LocalDate.now().plusDays(7));

        assertEquals(0, result); // placeholder availability is empty
        verify(apiClient).pushAvailability(eq("partner-1"), any());
        verify(apiClient).pushRates(eq("partner-1"), any());
        verify(connectionRepository).save(conn);
        assertNotNull(conn.getLastSyncAt());
    }

    @Test
    void pullBookings_noConnection_returnsEmpty() {
        when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

        List<GoogleVrBookingDto> result = service.pullBookings(1L);

        assertTrue(result.isEmpty());
        verify(apiClient, never()).getBookings(any());
    }

    @Test
    void pullBookings_inactiveConnection_returnsEmpty() {
        GoogleVrConnection conn = new GoogleVrConnection(1L, "p");
        conn.setStatus(GoogleVrConnection.GoogleVrConnectionStatus.ERROR);
        when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.of(conn));

        List<GoogleVrBookingDto> result = service.pullBookings(1L);

        assertTrue(result.isEmpty());
    }

    @Test
    void pullBookings_activeConnection_returnsBookingsAndSaves() {
        GoogleVrConnection conn = activeConnection();
        when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.of(conn));
        GoogleVrBookingDto booking = new GoogleVrBookingDto(
            "b1", "l1", "Jane", "j@x.com",
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5),
            java.math.BigDecimal.valueOf(450), "EUR", "CONFIRMED", 2);
        when(apiClient.getBookings("partner-1")).thenReturn(List.of(booking));

        List<GoogleVrBookingDto> result = service.pullBookings(1L);

        assertEquals(1, result.size());
        assertSame(booking, result.get(0));
        verify(connectionRepository).save(conn);
        assertNotNull(conn.getLastSyncAt());
    }
}
