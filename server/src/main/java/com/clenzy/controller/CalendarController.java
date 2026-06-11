package com.clenzy.controller;

import com.clenzy.integration.channel.AirbnbChannelAdapter;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.model.CalendarDay;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.ReservationService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
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
 * Chaque endpoint valide l'ownership via le mecanisme transverse
 * ReservationService.validatePropertyAccess (T-ARCH-08 : plus de copie
 * locale de la regle d'acces propriete dans ce controller).
 */
@RestController
@RequestMapping("/api/calendar")
@Tag(name = "Calendar", description = "Gestion du calendrier des proprietes (disponibilite, prix, blocage)")
@PreAuthorize("isAuthenticated()")
public class CalendarController {

    /**
     * Horizon du push manuel de prix, aligne sur celui du push automatique
     * horaire ({@code PricingPushScheduler.PUSH_HORIZON_DAYS}) : le push Airbnb
     * est sequentiel jour par jour, 365 jours seraient trop longs pour une
     * requete HTTP synchrone.
     */
    static final int PUSH_PRICING_HORIZON_DAYS = 90;

    private final CalendarEngine calendarEngine;
    private final ReservationService reservationService;
    private final TenantContext tenantContext;
    private final PriceEngine priceEngine;
    private final AirbnbChannelAdapter airbnbChannelAdapter;

    public CalendarController(CalendarEngine calendarEngine,
                              ReservationService reservationService,
                              TenantContext tenantContext,
                              PriceEngine priceEngine,
                              AirbnbChannelAdapter airbnbChannelAdapter) {
        this.calendarEngine = calendarEngine;
        this.reservationService = reservationService;
        this.tenantContext = tenantContext;
        this.priceEngine = priceEngine;
        this.airbnbChannelAdapter = airbnbChannelAdapter;
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

        List<CalendarDay> days = calendarEngine.getDays(propertyId, from, to, orgId);

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
    // GET : jours bloques pour le planning (batch multi-proprietes)
    // ----------------------------------------------------------------

    @GetMapping("/blocked")
    @Operation(summary = "Jours bloques pour le planning",
            description = "Retourne les jours BLOCKED et MAINTENANCE pour plusieurs proprietes sur une plage de dates.")
    public ResponseEntity<List<Map<String, Object>>> getBlockedDays(
            @RequestParam List<Long> propertyIds,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        Long orgId = tenantContext.getRequiredOrganizationId();

        List<CalendarDay> days = calendarEngine.getBlockedOrMaintenanceDays(propertyIds, from, to, orgId);

        List<Map<String, Object>> result = days.stream().map(day -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("propertyId", day.getProperty().getId());
            map.put("date", day.getDate().toString());
            map.put("status", day.getStatus().name());
            map.put("source", day.getSource());
            map.put("notes", day.getNotes());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
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

        // Prix MANUEL : cree aussi un RateOverride source MANUAL visible du
        // PriceEngine (devis booking engine, push OTA) — audit Z5-BUGS-04.
        calendarEngine.updateManualPrice(propertyId, from, to, price, orgId, jwt.getSubject());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("propertyId", propertyId);
        response.put("from", from.toString());
        response.put("to", to.toString());
        response.put("nightlyPrice", price.doubleValue());
        response.put("status", "UPDATED");

        return ResponseEntity.ok(response);
    }

    // ----------------------------------------------------------------
    // GET : pricing enrichi (calendrier + source de prix)
    // ----------------------------------------------------------------

    @GetMapping("/{propertyId}/pricing")
    @Operation(summary = "Calendrier de prix enrichi",
            description = "Retourne jour par jour : prix resolu, source du prix (override, plan, fallback), "
                    + "statut de disponibilite et reservation liee.")
    public ResponseEntity<List<Map<String, Object>>> getPricing(
            @PathVariable Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal Jwt jwt) {

        Long orgId = tenantContext.getRequiredOrganizationId();
        validatePropertyAccess(propertyId, jwt.getSubject(), orgId);

        // Charger les jours calendrier existants
        List<CalendarDay> days = calendarEngine.getDays(propertyId, from, to, orgId);
        Map<LocalDate, CalendarDay> dayMap = days.stream()
                .collect(Collectors.toMap(CalendarDay::getDate, d -> d));

        // Resoudre prix ET source via PriceEngine — source de verite unique de la
        // cascade (audit T-ARCH-04 : plus de re-implementation dans le controller).
        Map<LocalDate, PriceEngine.ResolvedPrice> prices =
                priceEngine.resolvePriceRangeWithSource(propertyId, from, to, orgId);

        // Construire la reponse enrichie pour chaque jour
        List<Map<String, Object>> result = new ArrayList<>();
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("date", date.toString());

            PriceEngine.ResolvedPrice resolved = prices.get(date);
            entry.put("nightlyPrice", resolved != null && resolved.price() != null
                    ? resolved.price().doubleValue() : null);

            CalendarDay day = dayMap.get(date);
            entry.put("status", day != null ? day.getStatus().name() : "AVAILABLE");
            entry.put("reservationId", day != null && day.getReservation() != null ? day.getReservation().getId() : null);

            entry.put("priceSource", resolved != null ? resolved.source() : PriceEngine.SOURCE_PROPERTY_DEFAULT);

            result.add(entry);
        }

        return ResponseEntity.ok(result);
    }

    // ----------------------------------------------------------------
    // POST : push prix vers Airbnb
    // ----------------------------------------------------------------

    @PostMapping("/{propertyId}/push-pricing")
    @Operation(summary = "Pousser les prix vers Airbnb",
            description = "Declenche un push manuel des prix resolus vers le listing Airbnb lie a la propriete "
                    + "(meme mecanisme que le push automatique horaire). "
                    + "409 si aucun mapping Airbnb n'est configure, 502 si l'API Airbnb echoue.")
    public ResponseEntity<Map<String, Object>> pushPricing(
            @PathVariable Long propertyId,
            @AuthenticationPrincipal Jwt jwt) {

        Long orgId = tenantContext.getRequiredOrganizationId();
        validatePropertyAccess(propertyId, jwt.getSubject(), orgId);

        // T-ARCH-09 : push reellement execute via AirbnbChannelAdapter (l'ancien
        // endpoint resolvait les prix puis repondait "PUSHED" sans rien pousser).
        LocalDate from = LocalDate.now();
        LocalDate to = from.plusDays(PUSH_PRICING_HORIZON_DAYS);
        SyncResult result = airbnbChannelAdapter.pushCalendarUpdate(propertyId, from, to, orgId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("propertyId", propertyId);
        response.put("from", from.toString());
        response.put("to", to.toString());
        response.put("daysResolved", result.getItemsProcessed());

        return switch (result.getStatus()) {
            case SUCCESS -> {
                response.put("status", "PUSHED");
                yield ResponseEntity.ok(response);
            }
            case SKIPPED -> {
                // Pas de mapping Airbnb pour cette propriete : rien n'a ete pousse
                response.put("status", "SKIPPED");
                response.put("message", result.getMessage());
                yield ResponseEntity.status(HttpStatus.CONFLICT).body(response);
            }
            case FAILED, UNSUPPORTED -> {
                response.put("status", "FAILED");
                response.put("message", result.getMessage());
                yield ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(response);
            }
        };
    }

    // ----------------------------------------------------------------
    // Validation ownership
    // ----------------------------------------------------------------

    /**
     * Valide l'acces a la propriete via le mecanisme transverse unique
     * (org courante + super admin + platform staff + owner) — T-ARCH-08 :
     * la copie locale de cette regle a ete supprimee au profit de
     * {@link ReservationService#validatePropertyAccess(Long, String)}.
     *
     * Conforme a CLAUDE.md §2 : "Ownership validation obligatoire"
     */
    private void validatePropertyAccess(Long propertyId, String keycloakId, Long orgId) {
        // orgId conserve en parametre pour la lisibilite des appels existants ;
        // la regle transverse resout l'organisation via TenantContext.
        reservationService.validatePropertyAccess(propertyId, keycloakId);
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
