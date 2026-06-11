package com.clenzy.integration.booking.service;

import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolution d'organisation pour le flux webhook Booking.com
 * — refactor T-ARCH-01 : plus aucun repository dans les controllers.
 *
 * <p><b>Lookup volontairement SANS validation d'organisation</b> : le webhook
 * est un flux public sans JWT (donc sans TenantContext). L'authentification y
 * est assuree par la signature HMAC du payload, validee en amont par
 * {@link BookingWebhookService#validateWebhookSignature(String, String)}, et la
 * connexion resolue porte elle-meme son organizationId — meme convention que
 * {@code PaymentTransactionService} pour les webhooks providers.</p>
 */
@Service
public class BookingConnectionQueryService {

    private final BookingConnectionRepository connectionRepository;

    public BookingConnectionQueryService(BookingConnectionRepository connectionRepository) {
        this.connectionRepository = connectionRepository;
    }

    /** Resout l'organizationId depuis un hotelId Booking.com (null si non lie). */
    @Transactional(readOnly = true)
    public Long resolveOrgId(String hotelId) {
        if (hotelId == null) return null;
        return connectionRepository.findByHotelId(hotelId)
                .map(BookingConnection::getOrganizationId)
                .orElse(null);
    }
}
