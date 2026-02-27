package com.clenzy.controller;

import com.clenzy.dto.ReservationDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ReservationMapper;
import com.clenzy.service.ReservationService;
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

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reservations")
@Tag(name = "Reservations", description = "Gestion des reservations (sejours voyageurs)")
@PreAuthorize("isAuthenticated()")
public class ReservationController {

    private final ReservationService reservationService;
    private final ReservationMapper reservationMapper;
    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public ReservationController(ReservationService reservationService,
                                 ReservationMapper reservationMapper,
                                 ReservationRepository reservationRepository,
                                 PropertyRepository propertyRepository,
                                 UserRepository userRepository,
                                 TenantContext tenantContext) {
        this.reservationService = reservationService;
        this.reservationMapper = reservationMapper;
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
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

    // ── GET : detail ────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    @Operation(summary = "Detail d'une reservation")
    public ResponseEntity<ReservationDto> getById(@PathVariable Long id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Reservation non trouvee: " + id));
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

        validatePropertyAccess(dto.propertyId(), jwt.getSubject());

        Reservation reservation = new Reservation();
        reservationMapper.apply(dto, reservation);
        reservation.setSource("direct");
        reservation.setStatus("confirmed");

        Reservation saved = reservationService.save(reservation);
        return ResponseEntity.ok(reservationMapper.toDto(saved));
    }

    // ── PUT : mise a jour ───────────────────────────────────────────────────

    @PutMapping("/{id}")
    @Operation(summary = "Modifier une reservation",
            description = "Reservations OTA : seuls notes et status modifiables. "
                    + "Reservations directes : tous les champs modifiables.")
    public ResponseEntity<ReservationDto> update(
            @PathVariable Long id,
            @RequestBody ReservationDto dto,
            @AuthenticationPrincipal Jwt jwt) {

        Reservation existing = reservationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Reservation non trouvee: " + id));

        validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());

        boolean isOta = !"direct".equals(existing.getSource());
        if (isOta) {
            // Reservations OTA : seuls notes et status modifiables
            if (dto.notes() != null) existing.setNotes(dto.notes());
            if (dto.status() != null) existing.setStatus(dto.status());
        } else {
            reservationMapper.apply(dto, existing);
        }

        Reservation saved = reservationRepository.save(existing);
        return ResponseEntity.ok(reservationMapper.toDto(saved));
    }

    // ── DELETE : annulation ──────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @Operation(summary = "Annuler une reservation",
            description = "Met le statut a 'cancelled' et libere les jours dans le calendrier.")
    public ResponseEntity<ReservationDto> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        Reservation existing = reservationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Reservation non trouvee: " + id));

        validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());

        Reservation cancelled = reservationService.cancel(id);
        return ResponseEntity.ok(reservationMapper.toDto(cancelled));
    }

    // ── Ownership validation ────────────────────────────────────────────────

    private void validatePropertyAccess(Long propertyId, String keycloakId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + propertyId));

        if (property.getOrganizationId() != null && !property.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Acces refuse : propriete hors de votre organisation");
        }

        if (tenantContext.isSuperAdmin()) return;

        User user = userRepository.findByKeycloakId(keycloakId).orElse(null);
        if (user != null && user.getRole() != null && user.getRole().isPlatformStaff()) return;

        // Comparaison par ID (PK) pour eviter LazyInitializationException sur le proxy User
        if (user != null && property.getOwner() != null
                && property.getOwner().getId().equals(user.getId())) return;

        throw new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete");
    }
}
