package com.clenzy.booking.controller;

import com.clenzy.booking.dto.CalendarAvailabilityResponseDto;
import com.clenzy.booking.service.BookingEngineCalendarService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Endpoints de calendrier de disponibilite pour le Booking Engine.
 * Accessible a tout utilisateur authentifie (preview dans le PMS).
 */
@RestController
@RequestMapping("/api/booking-engine/calendar")
@PreAuthorize("isAuthenticated()")
@Tag(name = "Booking Engine Calendar", description = "Calendrier de disponibilite et prix pour le Booking Engine")
public class BookingEngineCalendarController {

    private final BookingEngineCalendarService calendarService;
    private final TenantContext tenantContext;

    public BookingEngineCalendarController(BookingEngineCalendarService calendarService,
                                            TenantContext tenantContext) {
        this.calendarService = calendarService;
        this.tenantContext = tenantContext;
    }

    /**
     * GET /api/booking-engine/calendar/availability
     *
     * Retourne la disponibilite et le prix le plus bas par jour
     * pour les logements visibles du Booking Engine.
     *
     * @param from   premier jour (inclus, format yyyy-MM-dd)
     * @param to     dernier jour (inclus, format yyyy-MM-dd)
     * @param types  filtre par types de logement (optionnel, ex: APARTMENT,HOUSE)
     * @param guests filtre par capacite minimum (optionnel)
     */
    @GetMapping("/availability")
    @Operation(summary = "Calendrier de disponibilite agrege avec prix minimum par jour")
    public ResponseEntity<CalendarAvailabilityResponseDto> getAvailability(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<String> types,
            @RequestParam(required = false) Integer guests) {

        final Long orgId = tenantContext.getRequiredOrganizationId();
        final LocalDate today = LocalDate.now();

        // Sanitize : from ne peut pas etre dans le passe, plage max 6 mois
        final LocalDate effectiveFrom = from.isBefore(today) ? today : from;
        final LocalDate effectiveTo = effectiveFrom.plusMonths(6).isBefore(to) ? effectiveFrom.plusMonths(6) : to;

        return ResponseEntity.ok(
                calendarService.getCalendarAvailability(orgId, effectiveFrom, effectiveTo, types, guests));
    }
}
