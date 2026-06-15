package com.clenzy.booking.controller;

import com.clenzy.booking.service.GuestWishlistService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Wishlist (favoris) du voyageur (compte guest 2.11). Endpoints PUBLICS ({@code /api/public/**} est
 * permitAll dans SecurityConfigProd) : l'identité guest est validée par le token Keycloak (realm
 * clenzy-guests) côté service — pas de validation de ce realm dans SecurityConfig. Le token est
 * passé en en-tête {@code Authorization: Bearer ...}. Toutes les méthodes renvoient la liste à jour
 * des {@code propertyId} favoris.
 */
@RestController
@RequestMapping("/api/public/guest/wishlist")
@PreAuthorize("permitAll()")
public class PublicGuestWishlistController {

    private final GuestWishlistService service;

    public PublicGuestWishlistController(GuestWishlistService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<Long>> list(@RequestParam Long organizationId,
                                           @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(service.list(bearer(auth), organizationId));
    }

    @PostMapping
    public ResponseEntity<List<Long>> add(@RequestBody WishlistRequest req,
                                          @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(service.add(bearer(auth), req.organizationId(), req.propertyId()));
    }

    @DeleteMapping("/{propertyId}")
    public ResponseEntity<List<Long>> remove(@PathVariable Long propertyId,
                                             @RequestParam Long organizationId,
                                             @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(service.remove(bearer(auth), organizationId, propertyId));
    }

    public record WishlistRequest(Long organizationId, Long propertyId) {}

    private static String bearer(String authHeader) {
        if (authHeader != null && authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authHeader.substring(7).trim();
        }
        return authHeader;
    }
}
