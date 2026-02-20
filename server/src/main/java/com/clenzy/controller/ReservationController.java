package com.clenzy.controller;

import com.clenzy.model.Reservation;
import com.clenzy.service.ReservationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/reservations")
@Tag(name = "Reservations", description = "Gestion des reservations (sejours voyageurs)")
@PreAuthorize("isAuthenticated()")
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @GetMapping
    @Operation(summary = "Lister les reservations",
            description = "Retourne les reservations filtrees par proprietes et plage de dates. "
                    + "Admin/Manager voient tout, Host voit ses proprietes uniquement.")
    public ResponseEntity<List<Map<String, Object>>> getReservations(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) List<Long> propertyIds,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String status) {

        // Defaults : 3 mois avant/apres
        if (from == null) from = LocalDate.now().minusMonths(3);
        if (to == null) to = LocalDate.now().plusMonths(6);

        List<Reservation> reservations = reservationService.getReservations(
                jwt.getSubject(), propertyIds, from, to);

        // Filtre optionnel par statut
        if (status != null && !status.isEmpty() && !"all".equals(status)) {
            reservations = reservations.stream()
                    .filter(r -> status.equalsIgnoreCase(r.getStatus()))
                    .collect(Collectors.toList());
        }

        // Mapper vers la structure attendue par le frontend
        List<Map<String, Object>> result = reservations.stream().map(r -> {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("id", r.getId());
            map.put("propertyId", r.getProperty().getId());
            map.put("propertyName", r.getProperty().getName());
            map.put("guestName", r.getGuestName() != null ? r.getGuestName() : "");
            map.put("guestCount", r.getGuestCount() != null ? r.getGuestCount() : 1);
            map.put("checkIn", r.getCheckIn().toString());
            map.put("checkOut", r.getCheckOut().toString());
            map.put("checkInTime", r.getCheckInTime() != null ? r.getCheckInTime() : "15:00");
            map.put("checkOutTime", r.getCheckOutTime() != null ? r.getCheckOutTime() : "11:00");
            map.put("status", r.getStatus());
            map.put("source", r.getSource());
            map.put("totalPrice", r.getTotalPrice() != null ? r.getTotalPrice().doubleValue() : 0);
            map.put("notes", r.getNotes());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/property/{propertyId}")
    @Operation(summary = "Reservations d'une propriete",
            description = "Retourne toutes les reservations d'une propriete.")
    public ResponseEntity<List<Map<String, Object>>> getByProperty(
            @PathVariable Long propertyId) {

        List<Reservation> reservations = reservationService.getByProperty(propertyId);

        List<Map<String, Object>> result = reservations.stream().map(r -> {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("id", r.getId());
            map.put("propertyId", r.getProperty().getId());
            map.put("propertyName", r.getProperty().getName());
            map.put("guestName", r.getGuestName() != null ? r.getGuestName() : "");
            map.put("guestCount", r.getGuestCount() != null ? r.getGuestCount() : 1);
            map.put("checkIn", r.getCheckIn().toString());
            map.put("checkOut", r.getCheckOut().toString());
            map.put("checkInTime", r.getCheckInTime() != null ? r.getCheckInTime() : "15:00");
            map.put("checkOutTime", r.getCheckOutTime() != null ? r.getCheckOutTime() : "11:00");
            map.put("status", r.getStatus());
            map.put("source", r.getSource());
            map.put("totalPrice", r.getTotalPrice() != null ? r.getTotalPrice().doubleValue() : 0);
            map.put("notes", r.getNotes());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }
}
