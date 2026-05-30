package com.clenzy.integration.google.service;

import com.clenzy.integration.google.config.GoogleVacationRentalsConfig;
import com.clenzy.integration.google.dto.GoogleVrAvailabilityDto;
import com.clenzy.integration.google.dto.GoogleVrBookingDto;
import com.clenzy.integration.google.dto.GoogleVrListingDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GoogleVrApiClientTest {

    @Mock private GoogleVacationRentalsConfig config;
    @Mock private RestClient.Builder restClientBuilder;
    @Mock private RestClient restClient;

    private GoogleVrApiClient client;

    @BeforeEach
    void setUp() {
        when(restClientBuilder.baseUrl(any())).thenReturn(restClientBuilder);
        when(restClientBuilder.build()).thenReturn(restClient);
        lenient().when(config.getApiBaseUrl()).thenReturn("https://www.googleapis.com/travelpartner/v3");
        client = new GoogleVrApiClient(config, restClientBuilder);
    }

    @Test
    void pushAvailability_notConfigured_skipsCall() {
        when(config.isConfigured()).thenReturn(false);

        client.pushAvailability("partner-1", List.of());

        // No exception, no RestClient interaction (it's a TODO stub)
    }

    @Test
    void pushAvailability_configured_logsAndSucceeds() {
        when(config.isConfigured()).thenReturn(true);

        client.pushAvailability("partner-1", List.of(mockAvailability()));

        // No throw — placeholder behavior
    }

    @Test
    void pushRates_notConfigured_skipsCall() {
        when(config.isConfigured()).thenReturn(false);

        client.pushRates("partner-1", List.of());
    }

    @Test
    void pushRates_configured_logsAndSucceeds() {
        when(config.isConfigured()).thenReturn(true);

        client.pushRates("partner-1", List.of(mockAvailability()));
    }

    @Test
    void getBookings_notConfigured_returnsEmpty() {
        when(config.isConfigured()).thenReturn(false);

        List<GoogleVrBookingDto> result = client.getBookings("partner-1");

        assertTrue(result.isEmpty());
    }

    @Test
    void getBookings_configured_returnsEmpty() {
        when(config.isConfigured()).thenReturn(true);

        List<GoogleVrBookingDto> result = client.getBookings("partner-1");

        assertTrue(result.isEmpty());
    }

    @Test
    void pushListingData_notConfigured_skipsCall() {
        when(config.isConfigured()).thenReturn(false);

        client.pushListingData("partner-1", mockListing());
    }

    @Test
    void pushListingData_configured_logsAndSucceeds() {
        when(config.isConfigured()).thenReturn(true);

        client.pushListingData("partner-1", mockListing());
    }

    private GoogleVrAvailabilityDto mockAvailability() {
        return new GoogleVrAvailabilityDto(
            "listing-1", java.time.LocalDate.of(2026, 1, 1), true,
            new java.math.BigDecimal("100"), "EUR", 1, 30);
    }

    private GoogleVrListingDto mockListing() {
        return new GoogleVrListingDto(
            "lid", "plid", "Property", "Addr", 1.0, 2.0,
            "House", 4, 2, 1);
    }
}
