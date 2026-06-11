package com.clenzy.controller;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.dto.ReservationDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Reservation;
import com.clenzy.service.InterventionMapper;
import com.clenzy.service.ReservationMapper;
import com.clenzy.service.ReservationPaymentService;
import com.clenzy.service.ReservationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reservations")
@Tag(name = "Reservations", description = "Gestion des reservations (sejours voyageurs)")
@PreAuthorize("isAuthenticated()")
public class ReservationController {

    private static final Logger log = LoggerFactory.getLogger(ReservationController.class);

    private final ReservationService reservationService;
    private final ReservationMapper reservationMapper;
    private final ReservationPaymentService reservationPaymentService;
    private final InterventionMapper interventionMapper;

    public ReservationController(ReservationService reservationService,
                                 ReservationMapper reservationMapper,
                                 ReservationPaymentService reservationPaymentService,
                                 InterventionMapper interventionMapper) {
        this.reservationService = reservationService;
        this.reservationMapper = reservationMapper;
        this.reservationPaymentService = reservationPaymentService;
        this.interventionMapper = interventionMapper;
    }

    // ── GET : interventions liees a une reservation ─────────────────────────

    @GetMapping("/{id}/interventions")
    @Operation(summary = "Lister les interventions liees a une reservation")
    public ResponseEntity<List<InterventionResponse>> getLinkedInterventions(@PathVariable Long id) {
        List<InterventionResponse> responses = reservationService.getLinkedInterventions(id)
                .stream()
                .map(interventionMapper::convertToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
    }

    // ── GET : liste filtree ─────────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Lister les reservations",
            description = "Admin/Manager voient tout, Host voit ses proprietes uniquement.")
    public ResponseEntity<List<ReservationDto>> getReservations(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) List<Long> propertyIds,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String status) {

        if (from == null) from = LocalDate.now().minusMonths(3);
        if (to == null) to = LocalDate.now().plusMonths(6);

        List<Reservation> reservations = reservationService.getReservations(
                jwt.getSubject(), propertyIds, from, to);

        if (status != null && !status.isEmpty() && !"all".equals(status)) {
            final String statusFilter = status;
            reservations = reservations.stream()
                    .filter(r -> statusFilter.equalsIgnoreCase(r.getStatus()))
                    .collect(Collectors.toList());
        }

        List<ReservationDto> result = reservations.stream()
                .map(reservationMapper::toDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── GET : par propriete ─────────────────────────────────────────────────

    @GetMapping("/property/{propertyId}")
    @Operation(summary = "Reservations d'une propriete")
    public ResponseEntity<List<ReservationDto>> getByProperty(@PathVariable Long propertyId) {
        List<ReservationDto> result = reservationService.getByProperty(propertyId).stream()
                .map(reservationMapper::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ── GET : recherche (autocomplete rattachement « à trier ») ──────────────

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Rechercher des réservations par nom de guest ou de logement")
    public ResponseEntity<List<ReservationDto>> search(@RequestParam String q) {
        if (q == null || q.trim().length() < 2) {
            return ResponseEntity.ok(List.of());
        }
        List<ReservationDto> result = reservationService
                .searchByGuestOrProperty(q.trim(), 15).stream()
                .map(reservationMapper::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ── GET : detail ────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    @Operation(summary = "Detail d'une reservation")
    public ResponseEntity<ReservationDto> getById(@PathVariable Long id) {
        Reservation reservation = reservationService.getByIdFetchAll(id);
        return ResponseEntity.ok(reservationMapper.toDto(reservation));
    }

    // ── POST : creation ─────────────────────────────────────────────────────

    @PostMapping
    @Operation(summary = "Creer une reservation manuelle",
            description = "Cree une reservation directe (source = 'direct'). "
                    + "Valide l'ownership de la propriete et reserve les jours via CalendarEngine.")
    public ResponseEntity<ReservationDto> create(
            @RequestBody ReservationDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        reservationService.validatePropertyAccess(dto.propertyId(), jwt.getSubject());

        // Valider que le guest appartient a la meme organisation
        reservationService.validateGuestBelongsToOrganization(dto.guestId());

        Reservation reservation = new Reservation();
        reservationMapper.apply(dto, reservation);
        reservation.setSource("direct");
        reservation.setStatus(dto.status() != null ? dto.status() : "confirmed");

        Reservation saved = reservationService.save(reservation);

        // Auto-create cleaning intervention if requested
        if (Boolean.TRUE.equals(dto.createCleaning())) {
            reservationService.createCleaningForReservation(saved, jwt.getSubject());
        }

        // Re-load with all relations to avoid LazyInitializationException (open-in-view=false)
        Reservation result = reservationService.reloadWithRelations(saved);
        return ResponseEntity.ok(reservationMapper.toDto(result));
    }

    // ── PUT : mise a jour ───────────────────────────────────────────────────

    @PutMapping("/{id}")
    @Operation(summary = "Modifier une reservation",
            description = "Tous les champs sont modifiables (OTA et direct). "
                    + "Les changements de dates/statut sont synchronises avec le calendrier "
                    + "(liberation + re-reservation atomiques, 409 en cas de conflit).")
    public ResponseEntity<ReservationDto> update(
            @PathVariable Long id,
            @RequestBody ReservationDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        Reservation existing = reservationService.getByIdFetchAll(id);

        reservationService.validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());

        // Orchestration transactionnelle (calendrier, intervention, codes, notification)
        Reservation saved = reservationService.update(id, dto, jwt.getSubject());

        // Re-load with all relations for DTO conversion
        Reservation result = reservationService.reloadWithRelations(saved);
        return ResponseEntity.ok(reservationMapper.toDto(result));
    }

    // ── DELETE : annulation ──────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @Operation(summary = "Annuler une reservation",
            description = "Met le statut a 'cancelled' et libere les jours dans le calendrier.")
    public ResponseEntity<ReservationDto> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        Reservation existing = reservationService.getByIdFetchAll(id);

        reservationService.validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());

        reservationService.cancel(id);
        // Re-load with all relations for DTO conversion
        Reservation cancelled = reservationService.getByIdFetchAll(id);
        return ResponseEntity.ok(reservationMapper.toDto(cancelled));
    }

    // ── PATCH : masquer une reservation annulee du planning ─────────────────

    @PatchMapping("/{id}/hide")
    @Operation(summary = "Masquer une reservation annulee du planning",
            description = "Met hiddenFromPlanning=true. Restreint aux reservations cancelled.")
    public ResponseEntity<ReservationDto> hideFromPlanning(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        Reservation existing = reservationService.getByIdFetchAll(id);

        reservationService.validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());

        if (!"cancelled".equals(existing.getStatus())) {
            return ResponseEntity.badRequest().build();
        }

        existing.setHiddenFromPlanning(true);
        reservationService.persistHiddenFromPlanning(existing);

        return ResponseEntity.ok(reservationMapper.toDto(existing));
    }

    // ── POST : envoyer le lien de paiement par email ───────────────────────

    @PostMapping("/{id}/send-payment-link")
    @Operation(summary = "Envoyer un lien de paiement Stripe par email",
            description = "Cree une session Stripe Checkout pour le montant de la reservation "
                    + "et envoie le lien par email au guest. Peut etre renvoye a une adresse differente.")
    public ResponseEntity<ReservationDto> sendPaymentLink(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {

        Reservation reservation = reservationService.getByIdFetchAll(id);

        reservationService.validatePropertyAccess(reservation.getProperty().getId(), jwt.getSubject());

        Reservation result = reservationPaymentService.sendPaymentLink(reservation, body.get("email"));
        return ResponseEntity.ok(reservationMapper.toDto(result));
    }

    // ── POST : vérifier le paiement auprès de Stripe ──────────────────────

    @PostMapping("/{id}/check-payment")
    @Operation(summary = "Verifier le statut du paiement Stripe",
            description = "Verifie directement aupres de Stripe si le paiement a ete effectue. " +
                    "Utile quand le webhook n'a pas ete recu (dev, timeout, etc.).")
    public ResponseEntity<?> checkPaymentStatus(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            Reservation reservation = reservationService.getByIdFetchAll(id);

            reservationService.validatePropertyAccess(reservation.getProperty().getId(), jwt.getSubject());

            return ResponseEntity.ok(reservationPaymentService.checkPaymentStatus(reservation));
        } catch (NotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Erreur lors de la verification du paiement reservation {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur lors de la verification: " + e.getMessage()));
        }
    }
}
