package com.clenzy.integration.direct.controller;

import com.clenzy.integration.direct.dto.*;
import com.clenzy.integration.direct.service.DirectBookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Endpoints publics pour le widget de reservation directe.
 *
 * Ces endpoints sont accessibles sans authentification car le widget
 * est embarque sur le site web du proprietaire (contexte non-authentifie).
 *
 * Le path /api/public/** est deja en permitAll() dans SecurityConfigProd.
 */
@RestController
@org.springframework.security.access.prepost.PreAuthorize("permitAll()")
@RequestMapping("/api/public/direct-booking")
@Tag(name = "Direct Booking (Public)", description = "Widget de reservation directe - endpoints publics")
public class DirectBookingController {

    private static final Logger log = LoggerFactory.getLogger(DirectBookingController.class);

    private final DirectBookingService directBookingService;
    private final com.clenzy.integration.direct.service.BaitlyDirectBookingAdapter booking;

    public DirectBookingController(DirectBookingService directBookingService,com.clenzy.integration.direct.service.BaitlyDirectBookingAdapter booking) {
        this.directBookingService = directBookingService;
        this.booking=booking;
    }

    @PostMapping("/availability")
    @Operation(summary = "Verifier la disponibilite et obtenir le prix")
    public ResponseEntity<DirectAvailabilityResponse> checkAvailability(
            @Valid @RequestBody DirectAvailabilityRequest request,
            @RequestHeader(value = "X-Organization-Id", required = true) Long orgId) {
        log.debug("POST /api/public/direct-booking/availability: propertyId={}, orgId={}",
                request.propertyId(), orgId);
        DirectAvailabilityResponse response = booking.availability(request, orgId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/book")
    @Operation(summary = "Creer une reservation directe")
    public ResponseEntity<DirectBookingResponse> createBooking(
            @Valid @RequestBody DirectBookingRequest request,
            @RequestHeader(value = "X-Organization-Id", required = true) Long orgId) {
        log.debug("POST /api/public/direct-booking/book: propertyId={}, guest={} {}, orgId={}",
                request.propertyId(), request.guestFirstName(), request.guestLastName(), orgId);
        DirectBookingResponse response = booking.create(request, orgId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/book/{id}/confirm")
    @Operation(summary = "Confirmer une reservation apres paiement")
    public ResponseEntity<DirectBookingResponse> confirmBooking(
            @PathVariable("id") String bookingId,
            @RequestHeader(value = "X-Organization-Id", required = true) Long orgId) {
        log.debug("POST /api/public/direct-booking/book/{}/confirm: orgId={}", bookingId, orgId);
        DirectBookingResponse response = booking.confirm(bookingId, orgId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/property/{id}/summary")
    @Operation(summary = "Obtenir les informations d'une propriete pour le widget")
    public ResponseEntity<DirectPropertySummaryDto> getPropertySummary(
            @PathVariable("id") Long propertyId,
            @RequestHeader(value = "X-Organization-Id", required = true) Long orgId) {
        log.debug("GET /api/public/direct-booking/property/{}/summary: orgId={}", propertyId, orgId);
        // I1-OTA-03 : orgId obligatoire + verification d'une config direct booking
        // ENABLED pour (propertyId, orgId) cote service — pas de fuite cross-org.
        DirectPropertySummaryDto summary = directBookingService.getPropertySummary(propertyId, orgId);
        return ResponseEntity.ok(summary);
    }

    @PostMapping("/promo/validate")
    @Operation(summary = "Valider un code promo")
    public ResponseEntity<DirectPromoCodeDto> validatePromoCode(
            @Valid @RequestBody BaitlyDirectPromoPreview body,
            @RequestHeader(value = "X-Organization-Id", required = true) Long orgId) {
        DirectPromoCodeDto result = booking.preview(body, orgId);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/book/{id}/checkout")
    public com.clenzy.booking.dto.BookingCheckoutResponseDto resume(@PathVariable("id") String code,
            @RequestHeader("X-Organization-Id") Long org){return booking.resume(code,org);}
}
