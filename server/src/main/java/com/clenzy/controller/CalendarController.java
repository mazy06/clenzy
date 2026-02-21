package com.clenzy.controller;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * API calendrier pour la gestion des disponibilites par jour.
 *
 * Expose les endpoints pour :
 * - Lire la disponibilite d'une propriete sur une plage de dates
 * - Bloquer / debloquer des dates
 * - Mettre a jour les prix par nuit
 *
 * Les mutations sont deleguees au CalendarEngine qui gere
 * les advisory locks et l'anti-double-booking.
 *
 * Chaque endpoint valide l'ownership : l'utilisateur doit etre
 * proprietaire de la propriete ou avoir un role platform staff.
 */
@RestController
@RequestMapping("/api/calendar")
@Tag(name = "Calendar", description = "Gestion du calendrier des proprietes (disponibilite, prix, blocage)")
@PreAuthorize("isAuthenticated()")
public class CalendarController {

    private final CalendarEngine calendarEngine;
    private final CalendarDayRepository calendarDayRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public CalendarController(CalendarEngine calendarEngine,
                              CalendarDayRepository calendarDayRepository,
                              PropertyRepository propertyRepository,
                              UserRepository userRepository,
                              TenantContext tenantContext) {
        this.calendarEngine = calendarEngine;
        this.calendarDayRepository = calendarDayRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    // ----------------------------------------------------------------
    // GET : disponibilite
    // ----------------------------------------------------------------

    @GetMapping("/{propertyId}")
    @Operation(summary = "Disponibilite d'une propriete",
            description = "Retourne le calendrier jour par jour pour une propriete sur une plage de dates.")
    public ResponseEntity<List<Map<String, Object>>> getAvailability(
            @PathVariable Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        Long orgId = tenantContext.getRequiredOrganizationId();
        validatePropertyAccess(propertyId, jwt.getSubject(), orgId);

        List<CalendarDay> days = calendarDayRepository.findByPropertyAndDateRange(propertyId, from, to, orgId);

        List<Map<String, Object>> result = days.stream().map(this::mapDay).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ----------------------------------------------------------------
    // POST : bloquer des dates
    // ----------------------------------------------------------------

    @PostMapping("/{propertyId}/block")
    @Operation(summary = "Bloquer des dates",
            description = "Bloque les dates [from, to) pour une propriete. Refuse si des reservations existent.")
    public ResponseEntity<Map<String, Object>> blockDates(
            @PathVariable Long propertyId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        Long orgId = tenantContext.getRequiredOrganizationId();
        validatePropertyAccess(propertyId, jwt.getSubject(), orgId);

        LocalDate from = LocalDate.parse((String) body.get("from"));
        LocalDate to = LocalDate.parse((String) body.get("to"));
        String notes = (String) body.get("notes");
        String source = body.containsKey("source") ? (String) body.get("source") : "MANUAL";

        List<CalendarDay> blocked = calendarEngine.block(propertyId, from, to, orgId, source, notes, jwt.getSubject());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("propertyId", propertyId);
        response.put("from", from.toString());
        response.put("to", to.toString());
        response.put("daysBlocked", blocked.size());
        response.put("status", "BLOCKED");

        return ResponseEntity.ok(response);
    }

    // ----------------------------------------------------------------
    // DELETE : debloquer des dates
    // ----------------------------------------------------------------

    @DeleteMapping("/{propertyId}/block")
    @Operation(summary = "Debloquer des dates",
            description = "Debloque les dates [from, to) pour une propriete. Seuls les jours BLOCKED sont affectes.")
    public ResponseEntity<Map<String, Object>> unblockDates(
            @PathVariable Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        Long orgId = tenantContext.getRequiredOrganizationId();
        validatePropertyAccess(propertyId, jwt.getSubject(), orgId);

        int unblocked = calendarEngine.unblock(propertyId, from, to, orgId, jwt.getSubject());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("propertyId", propertyId);
        response.put("from", from.toString());
        response.put("to", to.toString());
        response.put("daysUnblocked", unblocked);
        response.put("status", "UNBLOCKED");

        return ResponseEntity.ok(response);
    }

    // ----------------------------------------------------------------
    // PUT : mettre a jour les prix
    // ----------------------------------------------------------------

    @PutMapping("/{propertyId}/price")
    @Operation(summary = "Mettre a jour les prix par nuit",
            description = "Met a jour le prix par nuit sur la plage [from, to) pour une propriete.")
    public ResponseEntity<Map<String, Object>> updatePrice(
            @PathVariable Long propertyId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        Long orgId = tenantContext.getRequiredOrganizationId();
        validatePropertyAccess(propertyId, jwt.getSubject(), orgId);

        LocalDate from = LocalDate.parse((String) body.get("from"));
        LocalDate to = LocalDate.parse((String) body.get("to"));
        BigDecimal price = new BigDecimal(body.get("price").toString());

        calendarEngine.updatePrice(propertyId, from, to, price, orgId, jwt.getSubject());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("propertyId", propertyId);
        response.put("from", from.toString());
        response.put("to", to.toString());
        response.put("nightlyPrice", price.doubleValue());
        response.put("status", "UPDATED");

        return ResponseEntity.ok(response);
    }

    // ----------------------------------------------------------------
    // Validation ownership
    // ----------------------------------------------------------------

    /**
     * Valide que l'utilisateur a acces a la propriete :
     * - Soit il est proprietaire (owner) de la propriete
     * - Soit il a un role platform staff (SUPER_ADMIN, SUPER_MANAGER)
     *
     * Conforme a CLAUDE.md §2 : "Ownership validation obligatoire"
     */
    private void validatePropertyAccess(Long propertyId, String keycloakId, Long orgId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new RuntimeException("Propriete introuvable: " + propertyId));

        // Verifier que la propriete appartient a la meme organisation
        if (property.getOrganizationId() != null && !property.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Acces refuse : propriete hors de votre organisation");
        }

        // Staff plateforme : acces autorise
        if (tenantContext.isSuperAdmin()) {
            return;
        }

        // Verifier l'ownership : l'utilisateur est-il le proprietaire ?
        User user = userRepository.findByKeycloakId(keycloakId).orElse(null);
        if (user != null && user.getRole() != null && user.getRole().isPlatformStaff()) {
            return;
        }

        // Verifier si l'utilisateur est le owner direct de la propriete
        if (property.getOwner() != null && property.getOwner().getKeycloakId() != null
                && property.getOwner().getKeycloakId().equals(keycloakId)) {
            return;
        }

        throw new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete");
    }

    // ----------------------------------------------------------------
    // Mapper
    // ----------------------------------------------------------------

    private Map<String, Object> mapDay(CalendarDay day) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("date", day.getDate().toString());
        map.put("status", day.getStatus().name());
        map.put("nightlyPrice", day.getNightlyPrice() != null ? day.getNightlyPrice().doubleValue() : null);
        map.put("minStay", day.getMinStay());
        map.put("maxStay", day.getMaxStay());
        map.put("changeoverDay", day.getChangeoverDay());
        map.put("source", day.getSource());
        map.put("notes", day.getNotes());
        map.put("reservationId", day.getReservation() != null ? day.getReservation().getId() : null);
        return map;
    }
}
