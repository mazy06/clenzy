package com.clenzy.service;

import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.model.Reservation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/** Public traveler return pages for payment links sent from the PMS. */
@Component
public class BaitlyReservationPaymentReturnUrls {
    private final BookingEngineConfigRepository configs;
    private final String baseUrl;

    public record Returns(String success, String cancel) {}

    public BaitlyReservationPaymentReturnUrls(BookingEngineConfigRepository configs,
            @Value("${clenzy.base-url:https://app.clenzy.fr}") String baseUrl) {
        this.configs = configs;
        this.baseUrl = baseUrl;
    }

    public Returns forReservation(Reservation stay) {
        Long org = stay.getOrganizationId();
        if (org == null) throw new IllegalArgumentException("Organisation de réservation requise");
        String key = configs.findAllByOrganizationId(org).stream()
                .filter(config -> org.equals(config.getOrganizationId()))
                .filter(BookingEngineConfig::isEnabled)
                .map(BookingEngineConfig::getApiKey)
                .filter(value -> value != null && !value.isBlank()).sorted().findFirst().orElse(null);
        boolean hasReference = stay.getConfirmationCode() != null && !stay.getConfirmationCode().isBlank();
        var url = UriComponentsBuilder.fromHttpUrl(baseUrl);
        if (key != null && hasReference) {
            url.pathSegment("booking", key, "confirmation")
                    .queryParam("reservation", stay.getConfirmationCode());
        } else {
            // A direct booking does not require an enabled booking engine. The
            // fallback is public, contains no personal data and never claims PAID.
            url.pathSegment("booking", "payment-return");
        }
        return new Returns(url.cloneBuilder().queryParam("flow", "return").build().encode().toUriString(),
                url.cloneBuilder().queryParam("flow", "cancel").build().encode().toUriString());
    }
}
