package com.clenzy.booking.service;

import com.clenzy.booking.dto.GuestBookingSummaryDto;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Liste des réservations directes passées d'un voyageur connecté (re-booking 1-clic, 2.11).
 * Lecture seule, scopée par (org, email) — l'email provient d'un token Keycloak guest validé,
 * donc le voyageur ne voit que ses propres séjours.
 */
@Service
public class PublicGuestBookingsService {

    /** Borne le nombre de séjours renvoyés au widget (les plus récents). */
    private static final int MAX_BOOKINGS = 12;

    private final ReservationRepository reservationRepository;

    public PublicGuestBookingsService(ReservationRepository reservationRepository) {
        this.reservationRepository = reservationRepository;
    }

    @Transactional(readOnly = true)
    public List<GuestBookingSummaryDto> listBookings(Long organizationId, String email) {
        if (organizationId == null || email == null || email.isBlank()) {
            return List.of();
        }
        final String normalized = email.trim().toLowerCase();
        return reservationRepository
                .findGuestDirectBookings(organizationId, normalized, PageRequest.of(0, MAX_BOOKINGS))
                .stream()
                .map(PublicGuestBookingsService::toDto)
                .toList();
    }

    private static GuestBookingSummaryDto toDto(Reservation r) {
        final Property property = r.getProperty();
        return new GuestBookingSummaryDto(
                r.getConfirmationCode(),
                property != null ? property.getId() : null,
                property != null ? property.getName() : null,
                r.getCheckIn(),
                r.getCheckOut(),
                r.getGuestCount() != null ? r.getGuestCount() : 1,
                r.getStatus(),
                r.getTotalPrice(),
                r.getCurrency());
    }
}
