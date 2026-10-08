package com.clenzy.service;

import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.model.Reservation;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class BaitlyReservationPaymentReturnUrlsTest {
    @Test
    void returnsToOwnPublicReservationForBothOutcomes() {
        var repository = mock(BookingEngineConfigRepository.class);
        when(repository.findAllByOrganizationId(2L)).thenReturn(List.of(config(3L, "foreign", true),
                config(2L, "disabled", false), config(2L, "local-key", true)));
        Reservation stay = new Reservation();
        stay.setOrganizationId(2L);
        stay.setConfirmationCode("DIR-TEST");
        var urls = new BaitlyReservationPaymentReturnUrls(repository, "https://app.example.test")
                .forReservation(stay);
        assertThat(urls.success()).isEqualTo("https://app.example.test/booking/local-key/confirmation?reservation=DIR-TEST&flow=return");
        assertThat(urls.cancel()).isEqualTo("https://app.example.test/booking/local-key/confirmation?reservation=DIR-TEST&flow=cancel");
    }

    @Test
    void organizationWithoutBookingEngineStillHasAPublicReturnWithoutPersonalData() {
        var repository = mock(BookingEngineConfigRepository.class);
        Reservation stay = new Reservation();
        stay.setOrganizationId(2L);
        stay.setGuestName("Private guest");
        stay.setConfirmationCode("DIR-TEST");
        var urls = new BaitlyReservationPaymentReturnUrls(repository, "http://localhost:3000")
                .forReservation(stay);
        assertThat(urls.success()).isEqualTo("http://localhost:3000/booking/payment-return?flow=return");
        assertThat(urls.cancel()).isEqualTo("http://localhost:3000/booking/payment-return?flow=cancel");
    }

    private BookingEngineConfig config(Long org, String key, boolean enabled) {
        var config = new BookingEngineConfig();
        config.setOrganizationId(org);
        config.setApiKey(key);
        config.setEnabled(enabled);
        return config;
    }
}
