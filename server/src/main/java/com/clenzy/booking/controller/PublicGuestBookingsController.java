package com.clenzy.booking.controller;

import com.clenzy.booking.dto.GuestBookingSummaryDto;
import com.clenzy.booking.service.BookingGuestAuthService;
import com.clenzy.booking.service.PublicGuestBookingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Réservations directes passées du voyageur connecté (re-booking 1-clic, 2.11). Endpoint PUBLIC
 * ({@code /api/public/**} = permitAll) ; l'identité guest est validée par le token Keycloak (realm
 * clenzy-guests) → email → ses propres séjours. Best-effort : token absent/invalide ⇒ liste vide.
 */
@RestController
@RequestMapping("/api/public/guest/bookings")
@PreAuthorize("permitAll()")
public class PublicGuestBookingsController {

    private final PublicGuestBookingsService bookingsService;
    private final BookingGuestAuthService guestAuthService;

    public PublicGuestBookingsController(PublicGuestBookingsService bookingsService,
                                         BookingGuestAuthService guestAuthService) {
        this.bookingsService = bookingsService;
        this.guestAuthService = guestAuthService;
    }

    @GetMapping
    public ResponseEntity<List<GuestBookingSummaryDto>> myBookings(
            @RequestParam Long organizationId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        final String email = guestAuthService.resolveGuestEmail(bearer(auth));
        return ResponseEntity.ok(bookingsService.listBookings(organizationId, email));
    }

    private static String bearer(String authHeader) {
        if (authHeader != null && authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authHeader.substring(7).trim();
        }
        return authHeader;
    }
}
