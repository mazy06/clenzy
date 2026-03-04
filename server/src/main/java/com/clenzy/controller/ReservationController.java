package com.clenzy.controller;

import com.clenzy.dto.ReservationDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.ReservationMapper;
import com.clenzy.service.ReservationService;
import com.clenzy.service.StripeService;
import com.clenzy.tenant.TenantContext;
import com.stripe.model.checkout.Session;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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
    private final GuestRepository guestRepository;
    private final StripeService stripeService;
    private final EmailService emailService;
    private final TenantContext tenantContext;

    public ReservationController(ReservationService reservationService,
                                 ReservationMapper reservationMapper,
                                 ReservationRepository reservationRepository,
                                 PropertyRepository propertyRepository,
                                 UserRepository userRepository,
                                 GuestRepository guestRepository,
                                 StripeService stripeService,
                                 EmailService emailService,
                                 TenantContext tenantContext) {
        this.reservationService = reservationService;
        this.reservationMapper = reservationMapper;
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.guestRepository = guestRepository;
        this.stripeService = stripeService;
        this.emailService = emailService;
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
        Reservation reservation = reservationRepository.findByIdFetchAll(id)
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

        // Valider que le guest appartient a la meme organisation
        if (dto.guestId() != null) {
            Long orgId = tenantContext.getRequiredOrganizationId();
            guestRepository.findByIdAndOrganizationId(dto.guestId(), orgId)
                    .orElseThrow(() -> new NotFoundException("Guest introuvable: " + dto.guestId()));
        }

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
        Reservation result = reservationRepository.findByIdFetchAll(saved.getId())
                .orElse(saved);
        return ResponseEntity.ok(reservationMapper.toDto(result));
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

        Reservation existing = reservationRepository.findByIdFetchAll(id)
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
        // Re-load with all relations for DTO conversion
        Reservation result = reservationRepository.findByIdFetchAll(saved.getId())
                .orElse(saved);
        return ResponseEntity.ok(reservationMapper.toDto(result));
    }

    // ── DELETE : annulation ──────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @Operation(summary = "Annuler une reservation",
            description = "Met le statut a 'cancelled' et libere les jours dans le calendrier.")
    public ResponseEntity<ReservationDto> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        Reservation existing = reservationRepository.findByIdFetchAll(id)
                .orElseThrow(() -> new NotFoundException("Reservation non trouvee: " + id));

        validatePropertyAccess(existing.getProperty().getId(), jwt.getSubject());

        reservationService.cancel(id);
        // Re-load with all relations for DTO conversion
        Reservation cancelled = reservationRepository.findByIdFetchAll(id)
                .orElseThrow(() -> new NotFoundException("Reservation non trouvee: " + id));
        return ResponseEntity.ok(reservationMapper.toDto(cancelled));
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

        Reservation reservation = reservationRepository.findByIdFetchAll(id)
                .orElseThrow(() -> new NotFoundException("Reservation non trouvee: " + id));

        validatePropertyAccess(reservation.getProperty().getId(), jwt.getSubject());

        // Determine email: use provided email or fall back to guest email
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            if (reservation.getGuest() != null && reservation.getGuest().getEmail() != null) {
                email = reservation.getGuest().getEmail();
            } else {
                throw new IllegalArgumentException("Aucune adresse email disponible pour ce guest");
            }
        }

        BigDecimal amount = reservation.getTotalPrice();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Le montant de la reservation doit etre superieur a 0");
        }

        try {
            // Create Stripe checkout session for the reservation
            Session session = stripeService.createReservationCheckoutSession(
                    reservation.getId(), amount, email, reservation.getGuestName(),
                    reservation.getProperty().getName());

            String paymentUrl = session.getUrl();

            // Send the payment link email
            String subject = "Lien de paiement - Reservation " + reservation.getProperty().getName();
            String htmlBody = buildPaymentEmailBody(
                    reservation.getGuestName(), reservation.getProperty().getName(),
                    reservation.getCheckIn().toString(), reservation.getCheckOut().toString(),
                    amount.toPlainString(), reservation.getCurrency(), paymentUrl);

            emailService.sendSimpleHtmlEmail(email, subject, htmlBody);

            // Update reservation tracking
            reservation.setPaymentLinkSentAt(LocalDateTime.now());
            reservation.setPaymentLinkEmail(email);
            reservation.setStripeSessionId(session.getId());
            reservationRepository.save(reservation);

            // Re-load with all relations
            Reservation result = reservationRepository.findByIdFetchAll(id).orElse(reservation);
            return ResponseEntity.ok(reservationMapper.toDto(result));

        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de l'envoi du lien de paiement: " + e.getMessage(), e);
        }
    }

    private String buildPaymentEmailBody(String guestName, String propertyName,
                                         String checkIn, String checkOut,
                                         String amount, String currency, String paymentUrl) {
        return """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #6B8A9A;">Lien de paiement</h2>
                <p>Bonjour %s,</p>
                <p>Veuillez trouver ci-dessous le lien pour proceder au paiement de votre reservation :</p>
                <table style="width: 100%%; border-collapse: collapse; margin: 20px 0;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Logement</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Check-in</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Check-out</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Montant</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">%s %s</td></tr>
                </table>
                <p style="text-align: center; margin: 30px 0;">
                    <a href="%s" style="background-color: #6B8A9A; color: white; padding: 12px 30px;
                       text-decoration: none; border-radius: 6px; font-weight: bold;">
                       Payer maintenant
                    </a>
                </p>
                <p style="color: #888; font-size: 12px;">
                    Ce lien est securise et vous redirigera vers la plateforme de paiement Stripe.
                </p>
            </div>
            """.formatted(guestName, propertyName, checkIn, checkOut, amount, currency, paymentUrl);
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
