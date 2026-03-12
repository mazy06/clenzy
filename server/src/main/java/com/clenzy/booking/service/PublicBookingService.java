package com.clenzy.booking.service;

import com.clenzy.booking.dto.*;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.dto.TouristTaxCalculationDto;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Service metier pour l'API publique du Booking Engine.
 * Reutilise CalendarEngine, PriceEngine, RestrictionEngine, GuestService, StripeService.
 * Aucune dependance a TenantContext — l'orgId est resolu via le slug/API Key.
 */
@Service
@Transactional(readOnly = true)
public class PublicBookingService {

    private static final Logger log = LoggerFactory.getLogger(PublicBookingService.class);

    /** Duree d'expiration d'une reservation PENDING (minutes). */
    private static final int PENDING_EXPIRATION_MINUTES = 30;

    private final BookingEngineConfigRepository configRepository;
    private final OrganizationRepository organizationRepository;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final PriceEngine priceEngine;
    private final RestrictionEngine restrictionEngine;
    private final CalendarEngine calendarEngine;
    private final GuestService guestService;
    private final TouristTaxService touristTaxService;
    private final StripeService stripeService;

    public PublicBookingService(
            BookingEngineConfigRepository configRepository,
            OrganizationRepository organizationRepository,
            PropertyRepository propertyRepository,
            ReservationRepository reservationRepository,
            CalendarDayRepository calendarDayRepository,
            PriceEngine priceEngine,
            RestrictionEngine restrictionEngine,
            CalendarEngine calendarEngine,
            GuestService guestService,
            TouristTaxService touristTaxService,
            StripeService stripeService) {
        this.configRepository = configRepository;
        this.organizationRepository = organizationRepository;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.priceEngine = priceEngine;
        this.restrictionEngine = restrictionEngine;
        this.calendarEngine = calendarEngine;
        this.guestService = guestService;
        this.touristTaxService = touristTaxService;
        this.stripeService = stripeService;
    }

    // ─── Resolution org ──────────────────────────────────────────────────────────

    /**
     * Resout l'organisation et verifie que le Booking Engine est active.
     * En mode multi-template, retourne la premiere config active.
     * Preferer resolveFromFilter() quand l'API Key a deja ete validee par le filtre.
     * @return le couple (Organization, BookingEngineConfig)
     * @throws IllegalArgumentException si slug invalide ou booking engine desactive
     */
    public OrgContext resolveOrg(String slug) {
        Organization org = organizationRepository.findBySlug(slug)
            .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable : " + slug));

        BookingEngineConfig config = configRepository.findAllByOrganizationId(org.getId())
            .stream()
            .filter(BookingEngineConfig::isEnabled)
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Booking Engine non configure ou desactive pour cette organisation"));

        return new OrgContext(org, config);
    }

    /**
     * Construit un OrgContext a partir du config deja resolu par le BookingApiKeyFilter.
     * Evite un second lookup en base et garantit que le template correct est utilise.
     */
    public OrgContext resolveFromFilter(BookingEngineConfig config) {
        Organization org = organizationRepository.findById(config.getOrganizationId())
            .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable"));
        return new OrgContext(org, config);
    }

    public record OrgContext(Organization org, BookingEngineConfig config) {
        public Long orgId() { return org.getId(); }
    }

    // ─── Config ──────────────────────────────────────────────────────────────────

    public BookingEngineConfigDto getConfig(OrgContext ctx) {
        return BookingEngineConfigDto.from(ctx.config());
    }

    // ─── Properties ──────────────────────────────────────────────────────────────

    public List<PublicPropertyDto> getProperties(OrgContext ctx) {
        return propertyRepository.findBookingEngineVisible(ctx.orgId())
            .stream()
            .map(PublicPropertyDto::from)
            .toList();
    }

    public PublicPropertyDetailDto getPropertyDetail(OrgContext ctx, Long propertyId) {
        Property property = propertyRepository.findBookingEngineProperty(propertyId, ctx.orgId())
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable ou non visible"));
        return PublicPropertyDetailDto.from(property);
    }

    // ─── Availability + Pricing ──────────────────────────────────────────────────

    public AvailabilityResponseDto checkAvailability(OrgContext ctx, AvailabilityRequestDto req) {
        Long orgId = ctx.orgId();
        Long propertyId = req.propertyId();
        LocalDate checkIn = req.checkIn();
        LocalDate checkOut = req.checkOut();
        int guests = req.guests();

        // Validation basique
        if (!checkOut.isAfter(checkIn)) {
            return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                List.of("checkOut doit etre apres checkIn"));
        }

        // Verifier que la propriete existe et est visible
        Property property = propertyRepository.findBookingEngineProperty(propertyId, orgId)
            .orElse(null);
        if (property == null) {
            return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                List.of("Propriete introuvable ou non visible"));
        }

        // Verifier le nombre de guests
        if (property.getMaxGuests() != null && guests > property.getMaxGuests()) {
            return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                List.of("Nombre de voyageurs depasse la capacite maximale (" + property.getMaxGuests() + ")"));
        }

        // Verifier advance days (min/max)
        long daysInAdvance = ChronoUnit.DAYS.between(LocalDate.now(), checkIn);
        BookingEngineConfig config = ctx.config();
        if (config.getMinAdvanceDays() != null && daysInAdvance < config.getMinAdvanceDays()) {
            return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                List.of("Reservation trop proche (minimum " + config.getMinAdvanceDays() + " jours a l'avance)"));
        }
        if (config.getMaxAdvanceDays() != null && daysInAdvance > config.getMaxAdvanceDays()) {
            return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                List.of("Reservation trop lointaine (maximum " + config.getMaxAdvanceDays() + " jours a l'avance)"));
        }

        // Verifier restrictions (min/max stay, closed to arrival/departure, etc.)
        RestrictionEngine.ValidationResult restrictions = restrictionEngine.validate(propertyId, checkIn, checkOut, orgId);
        if (!restrictions.isValid()) {
            return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                restrictions.getViolations());
        }

        // Verifier disponibilite calendrier (aucun jour BOOKED ou BLOCKED dans [checkIn, checkOut))
        long conflicts = calendarDayRepository.countConflicts(propertyId, checkIn, checkOut, orgId);
        if (conflicts > 0) {
            return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                List.of("Dates non disponibles"));
        }

        // Calculer le prix nuit par nuit
        int nights = (int) ChronoUnit.DAYS.between(checkIn, checkOut);
        Map<LocalDate, BigDecimal> priceMap = priceEngine.resolvePriceRange(propertyId, checkIn, checkOut, orgId);

        List<AvailabilityResponseDto.NightBreakdown> breakdown = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (LocalDate date = checkIn; date.isBefore(checkOut); date = date.plusDays(1)) {
            BigDecimal price = priceMap.getOrDefault(date, property.getNightlyPrice());
            if (price == null) {
                price = BigDecimal.ZERO;
            }
            // Determiner le type de tarif (simplifie — le PriceEngine ne retourne que le montant)
            String rateType = priceMap.containsKey(date) && priceMap.get(date) != null ? "CUSTOM" : "BASE";
            breakdown.add(new AvailabilityResponseDto.NightBreakdown(date, price, rateType));
            subtotal = subtotal.add(price);
        }

        // Frais de menage
        BigDecimal cleaningFee = BigDecimal.ZERO;
        if (config.isShowCleaningFee() && property.getCleaningBasePrice() != null) {
            cleaningFee = property.getCleaningBasePrice();
        }

        // Taxe de sejour
        BigDecimal touristTax = BigDecimal.ZERO;
        if (config.isShowTouristTax()) {
            BigDecimal avgNightlyRate = nights > 0
                ? subtotal.divide(BigDecimal.valueOf(nights), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
            TouristTaxCalculationDto taxCalc = touristTaxService.calculate(
                propertyId, orgId, nights, guests, avgNightlyRate);
            if (taxCalc != null) {
                touristTax = taxCalc.totalTax();
            }
        }

        BigDecimal total = subtotal.add(cleaningFee).add(touristTax);

        return new AvailabilityResponseDto(
            true,
            propertyId,
            property.getName(),
            checkIn,
            checkOut,
            guests,
            nights,
            breakdown,
            subtotal.setScale(2, RoundingMode.HALF_UP),
            cleaningFee.setScale(2, RoundingMode.HALF_UP),
            touristTax.setScale(2, RoundingMode.HALF_UP),
            total.setScale(2, RoundingMode.HALF_UP),
            property.getDefaultCurrency(),
            property.getMinimumNights(),
            property.getMaxGuests(),
            property.getDefaultCheckInTime(),
            property.getDefaultCheckOutTime(),
            List.of()
        );
    }

    // ─── Reserve ─────────────────────────────────────────────────────────────────

    @Transactional
    public BookingReserveResponseDto reserve(OrgContext ctx, BookingReserveRequestDto req) {
        Long orgId = ctx.orgId();

        // 1. Re-verifier la disponibilite (anti double-booking)
        AvailabilityResponseDto availability = checkAvailability(ctx, new AvailabilityRequestDto(
            req.propertyId(), req.checkIn(), req.checkOut(), req.guests()
        ));
        if (!availability.available()) {
            throw new IllegalStateException("Dates non disponibles : "
                + String.join(", ", availability.violations()));
        }

        // 2. Charger la propriete
        Property property = propertyRepository.findBookingEngineProperty(req.propertyId(), orgId)
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable"));

        // 3. Find or create guest
        String[] nameParts = splitName(req.guest().name());
        Guest guest = guestService.findOrCreate(
            nameParts[0], nameParts[1],
            req.guest().email(), req.guest().phone(),
            GuestChannel.DIRECT, null, orgId
        );

        // 4. Creer la reservation PENDING
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(orgId);
        reservation.setProperty(property);
        reservation.setGuest(guest);
        reservation.setGuestName(req.guest().name());
        reservation.setGuestCount(req.guests());
        reservation.setCheckIn(req.checkIn());
        reservation.setCheckOut(req.checkOut());
        reservation.setCheckInTime(property.getDefaultCheckInTime());
        reservation.setCheckOutTime(property.getDefaultCheckOutTime());
        reservation.setStatus("pending");
        reservation.setSource("direct");
        reservation.setSourceName("Clenzy Booking Engine");
        reservation.setCurrency(property.getDefaultCurrency());
        reservation.setNotes(req.notes());
        reservation.setPaymentStatus(PaymentStatus.PENDING);

        // Montants
        reservation.setRoomRevenue(availability.subtotal());
        reservation.setCleaningFee(availability.cleaningFee());
        reservation.setTouristTaxAmount(availability.touristTax());
        reservation.setTotalPrice(availability.total());

        // Code de confirmation unique
        reservation.setConfirmationCode(generateConfirmationCode());

        // Auto-confirm si active
        BookingEngineConfig config = ctx.config();
        if (config.isAutoConfirm()) {
            reservation.setStatus("confirmed");
        }

        // Si paiement non requis, marquer comme tel
        boolean requiresPayment = config.isCollectPaymentOnBooking();
        if (!requiresPayment) {
            reservation.setPaymentStatus(PaymentStatus.NOT_REQUIRED);
        }

        reservation = reservationRepository.save(reservation);

        // 5. Bloquer les dates via CalendarEngine
        calendarEngine.book(
            req.propertyId(), req.checkIn(), req.checkOut(),
            reservation.getId(), orgId, "direct", "booking-engine"
        );

        // 6. Calculer l'expiration (seulement si paiement requis et non auto-confirme)
        LocalDateTime expiresAt = requiresPayment && !config.isAutoConfirm()
            ? LocalDateTime.now().plusMinutes(PENDING_EXPIRATION_MINUTES)
            : null;

        String status = config.isAutoConfirm() ? "CONFIRMED" : "PENDING";
        log.info("Booking Engine: reservation {} {} creee pour property {} (org {}, requiresPayment={})",
            status, reservation.getConfirmationCode(), req.propertyId(), orgId, requiresPayment);

        return new BookingReserveResponseDto(
            reservation.getConfirmationCode(),
            status,
            property.getName(),
            req.checkIn(),
            req.checkOut(),
            availability.total(),
            property.getDefaultCurrency(),
            expiresAt,
            requiresPayment
        );
    }

    // ─── Checkout (Stripe) ───────────────────────────────────────────────────────

    @Transactional
    public BookingCheckoutResponseDto checkout(OrgContext ctx, BookingCheckoutRequestDto req) {
        Long orgId = ctx.orgId();

        // Guard: si collectPaymentOnBooking=false, pas de checkout Stripe
        if (!ctx.config().isCollectPaymentOnBooking()) {
            throw new IllegalStateException("Le paiement en ligne n'est pas active pour cette configuration");
        }

        Reservation reservation = reservationRepository
            .findByConfirmationCodeAndOrganizationId(req.reservationCode(), orgId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation introuvable : " + req.reservationCode()));

        // Accepter "pending" ou "confirmed" (autoConfirm=true + collectPaymentOnBooking=true)
        String status = reservation.getStatus();
        if (!"pending".equalsIgnoreCase(status) && !"confirmed".equalsIgnoreCase(status)) {
            throw new IllegalStateException("La reservation n'est pas en attente de paiement (statut: " + status + ")");
        }

        if (reservation.getPaymentStatus() == PaymentStatus.PAID) {
            throw new IllegalStateException("La reservation est deja payee");
        }

        try {
            String propertyName = reservation.getProperty() != null
                ? reservation.getProperty().getName() : "Reservation";
            String guestEmail = reservation.getGuest() != null
                ? reservation.getGuest().getEmail() : null;

            Session session = stripeService.createReservationCheckoutSession(
                reservation.getId(),
                reservation.getTotalPrice(),
                guestEmail,
                reservation.getGuestName(),
                propertyName
            );

            reservation.setStripeSessionId(session.getId());
            reservationRepository.save(reservation);

            log.info("Booking Engine: Stripe session {} creee pour reservation {}",
                session.getId(), reservation.getConfirmationCode());

            return new BookingCheckoutResponseDto(session.getUrl(), session.getId());
        } catch (Exception e) {
            log.error("Erreur Stripe checkout pour reservation {}: {}",
                reservation.getConfirmationCode(), e.getMessage(), e);
            throw new RuntimeException("Erreur lors de la creation du paiement", e);
        }
    }

    // ─── Confirmation ────────────────────────────────────────────────────────────

    public BookingConfirmationDto getConfirmation(OrgContext ctx, String reservationCode) {
        Long orgId = ctx.orgId();

        Reservation reservation = reservationRepository
            .findByConfirmationCodeAndOrganizationId(reservationCode, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation introuvable : " + reservationCode));

        Property property = reservation.getProperty();
        int nights = (int) ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut());

        return new BookingConfirmationDto(
            reservation.getConfirmationCode(),
            reservation.getStatus(),
            reservation.getPaymentStatus() != null ? reservation.getPaymentStatus().name() : null,
            property != null ? property.getName() : null,
            property != null ? property.getCity() : null,
            reservation.getCheckIn(),
            reservation.getCheckOut(),
            nights,
            reservation.getGuestCount() != null ? reservation.getGuestCount() : 1,
            reservation.getRoomRevenue(),
            reservation.getCleaningFee(),
            reservation.getTouristTaxAmount(),
            reservation.getTotalPrice(),
            reservation.getCurrency(),
            reservation.getGuestName(),
            reservation.getGuest() != null ? reservation.getGuest().getEmail() : null,
            reservation.getCheckInTime(),
            reservation.getCheckOutTime()
        );
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private String generateConfirmationCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder("RES-");
        Random random = new Random();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private String[] splitName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return new String[]{"Guest", ""};
        }
        String[] parts = fullName.trim().split("\\s+", 2);
        return parts.length == 2 ? parts : new String[]{parts[0], ""};
    }
}
