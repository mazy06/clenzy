package com.clenzy.booking.controller;

import com.clenzy.booking.service.BookingGuestAuthService;
import com.clenzy.booking.service.GuestCreditService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Solde de crédit fidélité du voyageur connecté (2.8). Endpoint PUBLIC ({@code /api/public/**} =
 * permitAll) ; l'identité guest est validée par le token Keycloak (realm clenzy-guests) → email →
 * compte de crédit. Best-effort : token absent/invalide ⇒ solde 0 (le widget n'affiche rien).
 */
@RestController
@RequestMapping("/api/public/guest/credit")
@PreAuthorize("permitAll()")
public class PublicGuestCreditController {

    private final GuestCreditService creditService;
    private final BookingGuestAuthService guestAuthService;

    public PublicGuestCreditController(GuestCreditService creditService, BookingGuestAuthService guestAuthService) {
        this.creditService = creditService;
        this.guestAuthService = guestAuthService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getBalance(@RequestParam Long organizationId,
                                                          @RequestHeader(value = "Authorization", required = false) String auth) {
        String email = guestAuthService.resolveGuestEmail(bearer(auth));
        long cents = email != null ? creditService.getBalanceCents(organizationId, email) : 0L;
        return ResponseEntity.ok(Map.of("balanceCents", cents));
    }

    private static String bearer(String authHeader) {
        if (authHeader != null && authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authHeader.substring(7).trim();
        }
        return authHeader;
    }
}
