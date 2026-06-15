package com.clenzy.booking.controller;

import com.clenzy.booking.dto.ReferralClaimRequestDto;
import com.clenzy.booking.service.BookingGuestAuthService;
import com.clenzy.booking.service.GuestReferralService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Parrainage voyageur (2.11). Endpoint PUBLIC ({@code /api/public/**} = permitAll).
 * - {@code GET} : code de parrainage du voyageur CONNECTÉ (token Keycloak guest validé → email).
 * - {@code POST /claim} : rattache un filleul (best-effort) après une réservation directe ; l'org est
 *   explicite et la réservation valide l'identité du filleul côté serveur (le filleul peut ne pas être connecté).
 * Controller mince : délégation au service.
 */
@RestController
@RequestMapping("/api/public/guest/referral")
@PreAuthorize("permitAll()")
public class PublicGuestReferralController {

    private final GuestReferralService referralService;
    private final BookingGuestAuthService guestAuthService;

    public PublicGuestReferralController(GuestReferralService referralService,
                                         BookingGuestAuthService guestAuthService) {
        this.referralService = referralService;
        this.guestAuthService = guestAuthService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> myReferral(
            @RequestParam Long organizationId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        String email = guestAuthService.resolveGuestEmail(bearer(auth));
        String code = email != null ? referralService.getOrCreateCode(organizationId, email) : null;
        return ResponseEntity.ok(Map.of(
            "code", code != null ? code : "",
            "creditCents", referralService.referralCreditCents(organizationId)));
    }

    @PostMapping("/claim")
    public ResponseEntity<Map<String, Boolean>> claim(@RequestBody ReferralClaimRequestDto body) {
        boolean claimed = referralService.claim(body.organizationId(), body.reservationCode(), body.referralCode());
        return ResponseEntity.ok(Map.of("claimed", claimed));
    }

    private static String bearer(String authHeader) {
        if (authHeader != null && authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authHeader.substring(7).trim();
        }
        return authHeader;
    }
}
