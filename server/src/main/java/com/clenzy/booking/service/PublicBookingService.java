package com.clenzy.booking.service;

import com.clenzy.booking.dto.*;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.dto.TouristTaxCalculationDto;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.RestrictionViolationException;
import com.clenzy.model.*;
import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import com.clenzy.service.email.BookingConfirmationEmailService;
import com.clenzy.service.voucher.VoucherApplyResult;
import com.clenzy.service.voucher.VoucherEngine;
import com.clenzy.service.voucher.VoucherValidationResult;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
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

    /**
     * Duree de vie de la session Stripe du flux /reserve + /checkout (minutes).
     * Legerement superieure au hold (30 min) pour absorber les horloges
     * decalees — Stripe impose un minimum de 30 min (reliquat revue A3 :
     * sans expires_at, une session restait payable 24h apres liberation des
     * dates).
     */
    private static final long CHECKOUT_SESSION_LIFETIME_MINUTES = 35;

    /** Borne haute raisonnable pour une date d'arrivee (anti dates absurdes). */
    private static final int MAX_ADVANCE_YEARS = 3;

    /** Duree maximale d'un sejour booking engine (nuits). */
    private static final int MAX_STAY_NIGHTS = 365;

    /**
     * Tolerance d'arrondi acceptee entre le montant reellement charge sur Stripe
     * et le devis recalcule serveur (Z4A-SEC-01).
     */
    public static final BigDecimal AMOUNT_TOLERANCE = new BigDecimal("0.01");

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
    private final GuestReviewRepository guestReviewRepository;
    private final VoucherEngine voucherEngine;
    private final NotificationService notificationService;
    private final BookingServiceOptionsService serviceOptionsService;
    private final BookingConfirmationEmailService bookingConfirmationEmailService;

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
            StripeService stripeService,
            GuestReviewRepository guestReviewRepository,
            VoucherEngine voucherEngine,
            NotificationService notificationService,
            BookingServiceOptionsService serviceOptionsService,
            BookingConfirmationEmailService bookingConfirmationEmailService) {
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
        this.guestReviewRepository = guestReviewRepository;
        this.voucherEngine = voucherEngine;
        this.notificationService = notificationService;
        this.serviceOptionsService = serviceOptionsService;
        this.bookingConfirmationEmailService = bookingConfirmationEmailService;
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

    /**
     * Property detail served to the booking-engine widget. Cached for 10 minutes
     * (via {@code booking-engine-properties}); invalidated by
     * {@code BookingEngineChannelAdapter} on host-profile change so embedded widgets
     * reflect new photos / names immediately.
     */
    @org.springframework.cache.annotation.Cacheable(
            value = "booking-engine-properties",
            key = "#ctx.orgId() + ':' + #propertyId")
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

        // Z4A-BUGS-08 : « aujourd'hui » s'evalue dans le fuseau de la PROPRIETE,
        // pas celui de la JVM (conteneur en UTC) — sinon off-by-one autour de
        // minuit (same-day refuse, ou date deja passee localement acceptee).
        LocalDate today = LocalDate.now(resolvePropertyZone(property));
        if (checkIn.isBefore(today)) {
            return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                List.of("checkIn est dans le passe"));
        }
        if (checkIn.isAfter(today.plusYears(MAX_ADVANCE_YEARS))) {
            return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                List.of("Date d'arrivee trop lointaine (maximum " + MAX_ADVANCE_YEARS + " ans)"));
        }
        if (ChronoUnit.DAYS.between(checkIn, checkOut) > MAX_STAY_NIGHTS) {
            return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                List.of("Duree de sejour maximale depassee (" + MAX_STAY_NIGHTS + " nuits)"));
        }

        // Verifier advance days (min/max) — meme reference timezone-aware
        long daysInAdvance = ChronoUnit.DAYS.between(today, checkIn);
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
            // Z4A-BUGS-06 : le PriceEngine insere chaque date dans la map, avec
            // valeur null si aucun tarif n'est configure (ni rate plan, ni
            // override, ni nightlyPrice). Une nuit sans tarif (ou <= 0) ne doit
            // JAMAIS etre facturee 0 EUR : la propriete n'est pas reservable.
            if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                return AvailabilityResponseDto.unavailable(propertyId, checkIn, checkOut, guests,
                    List.of("Tarif non configure pour la nuit du " + date));
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

    /**
     * Fuseau horaire de la propriete (defaut Europe/Paris si absent ou invalide)
     * pour evaluer « aujourd'hui » cote booking engine (Z4A-BUGS-08).
     */
    private ZoneId resolvePropertyZone(Property property) {
        String tz = property.getTimezone();
        if (tz == null || tz.isBlank()) {
            return ZoneId.of("Europe/Paris");
        }
        try {
            return ZoneId.of(tz);
        } catch (DateTimeException e) {
            log.warn("Timezone invalide '{}' pour property {} — fallback Europe/Paris",
                tz, property.getId());
            return ZoneId.of("Europe/Paris");
        }
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

        // Voucher : validate + apply si code fourni. Le total publie devient le
        // {@code original_total}, le {@code total_price} final inclut le discount.
        // Si le code est invalide, on degrade silencieusement (booking continue
        // sans discount + log warning) plutot que de bloquer le booking en cours.
        // L'endpoint /api/public/vouchers/validate doit etre appele AVANT par le
        // booking engine pour eviter cette surprise UX.
        BigDecimal originalTotal = availability.total();
        VoucherApplyResult voucherApplied = null;
        BookingVoucher appliedVoucher = null;
        // Tracker la raison de refus pour la remonter dans la response DTO
        // (fix M1 code review : evite la degradation silencieuse cote guest).
        com.clenzy.service.voucher.VoucherValidationError voucherRejectionReason = null;
        if (req.voucherCode() != null && !req.voucherCode().isBlank()) {
            int nights = (int) ChronoUnit.DAYS.between(req.checkIn(), req.checkOut());
            VoucherValidationResult validation = voucherEngine.validate(
                orgId, req.voucherCode(), req.propertyId(), nights, originalTotal,
                req.guest().email(), VoucherChannelScope.BOOKING_ENGINE
            );
            if (validation instanceof VoucherValidationResult.Valid valid) {
                appliedVoucher = valid.voucher();
                voucherApplied = voucherEngine.apply(appliedVoucher, originalTotal, nights);
                reservation.setOriginalTotal(voucherApplied.originalTotal());
                reservation.setDiscountAmount(voucherApplied.discountApplied());
                reservation.setVoucherCode(appliedVoucher.getCode());
                reservation.setBookingVoucherId(appliedVoucher.getId());
                reservation.setTotalPrice(voucherApplied.finalTotal());
                log.info("Voucher applied during reserve : code={}, discount={}",
                    appliedVoucher.getCode(), voucherApplied.discountApplied());
            } else {
                VoucherValidationResult.Invalid invalid = (VoucherValidationResult.Invalid) validation;
                voucherRejectionReason = invalid.reason();
                log.warn("Voucher rejected during reserve : code={}, reason={} ({})",
                    req.voucherCode(), invalid.reason(), invalid.message());
                reservation.setTotalPrice(originalTotal);
            }
        } else {
            reservation.setTotalPrice(originalTotal);
        }

        // Code de confirmation unique
        reservation.setConfirmationCode(generateConfirmationCode());

        // Auto-confirm si active — mais jamais avant paiement quand le paiement est
        // collecte a la reservation (Z4A-BUGS-04) : la confirmation intervient au
        // webhook Stripe (confirmReservationPayment passe pending → confirmed).
        BookingEngineConfig config = ctx.config();
        boolean requiresPayment = config.isCollectPaymentOnBooking();
        if (config.isAutoConfirm() && !requiresPayment) {
            reservation.setStatus("confirmed");
        }

        // Si paiement non requis, marquer comme tel
        if (!requiresPayment) {
            reservation.setPaymentStatus(PaymentStatus.NOT_REQUIRED);
        }

        reservation = reservationRepository.save(reservation);

        // 4b. Si un voucher a ete applique, enregistrer l'usage + incrementer
        // le compteur atomiquement (CAS). Si la race condition se realise
        // (autre booking simultane a consomme la derniere place), on rollback
        // les champs voucher_* sur la reservation pour rester consistant.
        if (appliedVoucher != null && voucherApplied != null) {
            var usageOpt = voucherEngine.recordUsage(
                appliedVoucher, reservation.getId(), orgId, req.propertyId(),
                voucherApplied, req.guest().email(), "BOOKING_ENGINE"
            );
            if (usageOpt.isEmpty()) {
                log.warn("Voucher race on max_uses_total : booking {} sauve sans discount",
                    reservation.getConfirmationCode());
                reservation.setOriginalTotal(null);
                reservation.setDiscountAmount(null);
                reservation.setVoucherCode(null);
                reservation.setBookingVoucherId(null);
                reservation.setTotalPrice(originalTotal);
                reservation = reservationRepository.save(reservation);
            }
        }

        // 5. Bloquer les dates via CalendarEngine
        calendarEngine.book(
            req.propertyId(), req.checkIn(), req.checkOut(),
            reservation.getId(), orgId, "direct", "booking-engine"
        );

        // 6. Calculer l'expiration : des qu'un paiement est attendu, la reservation
        // reste pending et expire si non payee (Z4A-BUGS-04 — le cleanup scheduler
        // ne ramasse que les reservations status='pending').
        LocalDateTime expiresAt = requiresPayment
            ? LocalDateTime.now().plusMinutes(PENDING_EXPIRATION_MINUTES)
            : null;

        String status = reservation.getStatus().toUpperCase();
        log.info("Booking Engine: reservation {} {} creee pour property {} (org {}, requiresPayment={})",
            status, reservation.getConfirmationCode(), req.propertyId(), orgId, requiresPayment);

        // HP-03.1 : email de confirmation pour les reservations confirmees SANS paiement
        // (le chemin paye envoie l'email au webhook Stripe via confirmReservationPayment).
        // APRES COMMIT (audit #2), best-effort : un echec d'envoi n'impacte pas la reservation.
        if (!requiresPayment && "confirmed".equalsIgnoreCase(reservation.getStatus())) {
            final Long confirmedReservationId = reservation.getId();
            runAfterCommit(() -> {
                try {
                    bookingConfirmationEmailService.sendForReservation(confirmedReservationId);
                } catch (Exception e) {
                    log.warn("Email de confirmation (booking direct) non envoye pour la reservation {}: {}",
                            confirmedReservationId, e.getMessage());
                }
            });
        }

        // Construction du DTO via helpers explicites pour exposer l'etat du
        // voucher au guest (succes / refus / pas demande).
        if (voucherApplied != null) {
            return BookingReserveResponseDto.withVoucherApplied(
                reservation.getConfirmationCode(), status, property.getName(),
                req.checkIn(), req.checkOut(),
                reservation.getTotalPrice(), property.getDefaultCurrency(),
                expiresAt, requiresPayment,
                voucherApplied.originalTotal(), voucherApplied.discountApplied()
            );
        } else if (voucherRejectionReason != null) {
            return BookingReserveResponseDto.withVoucherRejected(
                reservation.getConfirmationCode(), status, property.getName(),
                req.checkIn(), req.checkOut(),
                reservation.getTotalPrice(), property.getDefaultCurrency(),
                expiresAt, requiresPayment, voucherRejectionReason
            );
        }
        return BookingReserveResponseDto.withoutVoucher(
            reservation.getConfirmationCode(), status, property.getName(),
            req.checkIn(), req.checkOut(),
            reservation.getTotalPrice(), property.getDefaultCurrency(),
            expiresAt, requiresPayment
        );
    }

    // ─── Reserve Batch (panier multi-sejours) ────────────────────────────────────

    /**
     * Cree un panier de reservations PENDING en une seule transaction atomique.
     *
     * <p>Tous les items doivent etre disponibles : si un seul ne l'est pas, on rollback
     * et on retourne une erreur. Cela evite des reservations partielles que le guest
     * ne pourrait pas payer ou annuler proprement.</p>
     *
     * <p>Le guest est partage entre tous les items (1 seul {@link Guest} cree ou trouve).</p>
     *
     * <p>Toutes les proprietes doivent avoir la meme devise par defaut (sinon erreur).</p>
     */
    @Transactional
    public BookingReserveBatchResponseDto reserveBatch(OrgContext ctx, BookingReserveBatchRequestDto req) {
        Long orgId = ctx.orgId();
        BookingEngineConfig config = ctx.config();

        if (req.items() == null || req.items().isEmpty()) {
            throw new IllegalArgumentException("Le panier doit contenir au moins un item");
        }

        // Z4A-BUGS-09 : deux items du panier qui se chevauchent sur la meme
        // propriete passeraient chacun la pre-validation individuelle puis
        // echoueraient au blocage calendrier — rejet propre des l'entree,
        // aucune reservation creee.
        rejectOverlappingItems(req.items());

        // ─── 1. Pre-validation : disponibilite de chaque item ────────────────────
        // (on fait toutes les checks d'abord avant de creer quoi que ce soit)
        List<AvailabilityResponseDto> availabilities = new ArrayList<>(req.items().size());
        Set<String> currencies = new HashSet<>();

        for (int i = 0; i < req.items().size(); i++) {
            BookingReserveBatchRequestDto.Item item = req.items().get(i);
            AvailabilityResponseDto availability = checkAvailability(ctx, new AvailabilityRequestDto(
                item.propertyId(), item.checkIn(), item.checkOut(), item.guests()
            ));
            if (!availability.available()) {
                throw new IllegalStateException("Item " + (i + 1) + " (propriete " + item.propertyId()
                    + ") non disponible : " + String.join(", ", availability.violations()));
            }
            availabilities.add(availability);
            if (availability.currency() != null) {
                currencies.add(availability.currency());
            }
        }

        if (currencies.size() > 1) {
            throw new IllegalStateException("Toutes les proprietes du panier doivent avoir la meme devise "
                + "(detectees : " + String.join(", ", currencies) + ")");
        }
        String batchCurrency = currencies.isEmpty() ? "EUR" : currencies.iterator().next();

        // ─── 2. Find or create guest (partage entre tous les items) ─────────────
        String[] nameParts = splitName(req.guest().name());
        Guest guest = guestService.findOrCreate(
            nameParts[0], nameParts[1],
            req.guest().email(), req.guest().phone(),
            GuestChannel.DIRECT, null, orgId
        );

        // ─── 3. Generer le batchCode (UUID) ─────────────────────────────────────
        String batchCode = UUID.randomUUID().toString();

        // ─── 4. Creer chaque reservation PENDING ────────────────────────────────
        List<BookingReserveResponseDto> responses = new ArrayList<>(req.items().size());
        BigDecimal grandTotal = BigDecimal.ZERO;
        LocalDateTime earliestExpiration = null;
        boolean requiresPayment = config.isCollectPaymentOnBooking();
        // Z4A-BUGS-04 : pas d'auto-confirm tant que le paiement attendu n'est pas recu
        boolean autoConfirmed = config.isAutoConfirm() && !requiresPayment;

        for (int i = 0; i < req.items().size(); i++) {
            BookingReserveBatchRequestDto.Item item = req.items().get(i);
            AvailabilityResponseDto availability = availabilities.get(i);

            Property property = propertyRepository.findBookingEngineProperty(item.propertyId(), orgId)
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable : " + item.propertyId()));

            Reservation reservation = new Reservation();
            reservation.setOrganizationId(orgId);
            reservation.setProperty(property);
            reservation.setGuest(guest);
            reservation.setGuestName(req.guest().name());
            reservation.setGuestCount(item.guests());
            reservation.setCheckIn(item.checkIn());
            reservation.setCheckOut(item.checkOut());
            reservation.setCheckInTime(property.getDefaultCheckInTime());
            reservation.setCheckOutTime(property.getDefaultCheckOutTime());
            reservation.setStatus(autoConfirmed ? "confirmed" : "pending");
            reservation.setSource("direct");
            reservation.setSourceName("Clenzy Booking Engine (batch)");
            reservation.setCurrency(property.getDefaultCurrency());
            reservation.setNotes(item.notes());
            reservation.setPaymentStatus(requiresPayment ? PaymentStatus.PENDING : PaymentStatus.NOT_REQUIRED);

            reservation.setRoomRevenue(availability.subtotal());
            reservation.setCleaningFee(availability.cleaningFee());
            reservation.setTouristTaxAmount(availability.touristTax());
            reservation.setTotalPrice(availability.total());

            reservation.setConfirmationCode(generateConfirmationCode());
            reservation = reservationRepository.save(reservation);

            // Bloquer les dates
            calendarEngine.book(
                item.propertyId(), item.checkIn(), item.checkOut(),
                reservation.getId(), orgId, "direct", "booking-engine-batch:" + batchCode
            );

            LocalDateTime expiresAt = requiresPayment
                ? LocalDateTime.now().plusMinutes(PENDING_EXPIRATION_MINUTES)
                : null;
            if (expiresAt != null && (earliestExpiration == null || expiresAt.isBefore(earliestExpiration))) {
                earliestExpiration = expiresAt;
            }

            grandTotal = grandTotal.add(availability.total());

            // Batch reserve : pas de support voucher en V1 (cf. TODO doc).
            responses.add(BookingReserveResponseDto.withoutVoucher(
                reservation.getConfirmationCode(),
                reservation.getStatus().toUpperCase(),
                property.getName(),
                item.checkIn(), item.checkOut(),
                availability.total(),
                property.getDefaultCurrency(),
                expiresAt,
                requiresPayment
            ));
        }

        log.info("Booking Engine: batch {} cree avec {} reservations (total: {} {}, org: {})",
            batchCode, responses.size(), grandTotal, batchCurrency, orgId);

        return new BookingReserveBatchResponseDto(
            batchCode, responses, grandTotal, batchCurrency, earliestExpiration, requiresPayment
        );
    }

    /**
     * Rejette les paniers contenant deux sejours qui se chevauchent sur la meme
     * propriete (Z4A-BUGS-09) — la pre-validation item par item ne voit pas les
     * autres items du meme panier.
     */
    private void rejectOverlappingItems(List<BookingReserveBatchRequestDto.Item> items) {
        for (int i = 0; i < items.size(); i++) {
            for (int j = i + 1; j < items.size(); j++) {
                BookingReserveBatchRequestDto.Item a = items.get(i);
                BookingReserveBatchRequestDto.Item b = items.get(j);
                boolean sameProperty = Objects.equals(a.propertyId(), b.propertyId());
                boolean overlaps = a.checkIn().isBefore(b.checkOut())
                    && b.checkIn().isBefore(a.checkOut());
                if (sameProperty && overlaps) {
                    throw new IllegalArgumentException("Items " + (i + 1) + " et " + (j + 1)
                        + " du panier se chevauchent sur la propriete " + a.propertyId());
                }
            }
        }
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

            // expires_at ~35 min : la session devient inutilisable peu apres
            // l'expiration du hold de 30 min (reliquat revue A3).
            Session session = stripeService.createReservationCheckoutSession(
                reservation.getId(),
                reservation.getTotalPrice(),
                guestEmail,
                reservation.getGuestName(),
                propertyName,
                java.time.Duration.ofMinutes(CHECKOUT_SESSION_LIFETIME_MINUTES)
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

    // ─── Embedded Checkout : retenue des dates (Z4A-BUGS-03) ─────────────────────

    /**
     * Cree la reservation PENDING qui retient les dates pendant le paiement
     * Embedded Checkout. Bloque le calendrier sous lock : une
     * {@link CalendarConflictException} remonte si un autre guest a reserve
     * les memes dates entre la verification de disponibilite et l'appel.
     *
     * <p>Z4A-BUGS-10 : les options de service selectionnees sont snapshotees en
     * {@code ReservationServiceItem} et {@code serviceOptionsTotal} est renseigne
     * sur le hold — le totalPrice (sejour + options) est ainsi entierement
     * ventile des la creation, et la facture generee au paiement est complete.</p>
     *
     * <p>Le hold suit le cycle de vie standard des reservations pending : s'il
     * n'est pas paye sous 30 minutes, {@link PendingReservationCleanupScheduler}
     * expire la session Stripe puis libere les dates.</p>
     */
    @Transactional
    public Reservation createEmbeddedCheckoutHold(OrgContext ctx, Long propertyId,
            LocalDate checkIn, LocalDate checkOut, int guests,
            String customerEmail, String customerName,
            AvailabilityResponseDto availability, BigDecimal serviceOptionsTotal,
            List<SelectedServiceOptionDto> serviceOptions) {
        Long orgId = ctx.orgId();
        Property property = propertyRepository.findBookingEngineProperty(propertyId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable"));

        String[] nameParts = splitName(customerName);
        Guest guest = guestService.findOrCreate(
            nameParts[0], nameParts[1], customerEmail, null,
            GuestChannel.DIRECT, null, orgId);

        String guestName = (customerName != null && !customerName.isBlank())
            ? customerName : nameParts[0];
        BigDecimal totalPrice = availability.total().add(
            serviceOptionsTotal != null ? serviceOptionsTotal : BigDecimal.ZERO);

        Reservation reservation = buildPendingReservation(
            property, guest, orgId, guestName, guests, checkIn, checkOut, availability, totalPrice);
        reservation = reservationRepository.save(reservation);

        calendarEngine.book(propertyId, checkIn, checkOut,
            reservation.getId(), orgId, "direct", "booking-engine-embedded");

        snapshotServiceOptions(reservation, serviceOptions, guests, checkIn, checkOut, orgId);

        log.info("Booking Engine: hold PENDING {} cree pour property {} (org {})",
            reservation.getConfirmationCode(), propertyId, orgId);
        return reservation;
    }

    /**
     * Surcharge retro-compatible (signature historique sans selections) —
     * le hold est cree sans snapshot d'options.
     */
    @Transactional
    public Reservation createEmbeddedCheckoutHold(OrgContext ctx, Long propertyId,
            LocalDate checkIn, LocalDate checkOut, int guests,
            String customerEmail, String customerName,
            AvailabilityResponseDto availability, BigDecimal serviceOptionsTotal) {
        return createEmbeddedCheckoutHold(ctx, propertyId, checkIn, checkOut, guests,
            customerEmail, customerName, availability, serviceOptionsTotal, List.of());
    }

    /** Snapshot des options de service en lignes de reservation (Z4A-BUGS-10). */
    private void snapshotServiceOptions(Reservation reservation,
            List<SelectedServiceOptionDto> serviceOptions, int guests,
            LocalDate checkIn, LocalDate checkOut, Long orgId) {
        if (serviceOptions == null || serviceOptions.isEmpty()) {
            return;
        }
        int nights = Math.max(1, (int) ChronoUnit.DAYS.between(checkIn, checkOut));
        serviceOptionsService.createReservationServiceItems(
            reservation, serviceOptions, guests, nights, orgId);
    }

    /** Associe la session Stripe au hold cree par {@link #createEmbeddedCheckoutHold}. */
    @Transactional
    public void attachStripeSessionToHold(Long reservationId, String sessionId) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation introuvable : " + reservationId));
        reservation.setStripeSessionId(sessionId);
        reservationRepository.save(reservation);
    }

    /** Annule un hold dont la session Stripe n'a pas pu etre creee (rollback). */
    @Transactional
    public void releaseEmbeddedCheckoutHold(Long reservationId) {
        reservationRepository.findById(reservationId).ifPresent(reservation -> {
            reservation.setStatus("cancelled");
            reservation.setPaymentStatus(PaymentStatus.CANCELLED);
            reservationRepository.save(reservation);
            calendarEngine.cancel(reservationId, reservation.getOrganizationId(),
                "booking-engine-embedded-rollback");
            log.info("Booking Engine: hold {} libere (session Stripe non creee)",
                reservation.getConfirmationCode());
        });
    }

    /** Construit une reservation pending non payee du flux booking engine. */
    private Reservation buildPendingReservation(Property property, Guest guest, Long orgId,
            String guestName, int guests, LocalDate checkIn, LocalDate checkOut,
            AvailabilityResponseDto availability, BigDecimal totalPrice) {
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(orgId);
        reservation.setProperty(property);
        reservation.setGuest(guest);
        reservation.setGuestName(guestName);
        reservation.setGuestCount(guests);
        reservation.setCheckIn(checkIn);
        reservation.setCheckOut(checkOut);
        reservation.setCheckInTime(property.getDefaultCheckInTime());
        reservation.setCheckOutTime(property.getDefaultCheckOutTime());
        reservation.setStatus("pending");
        reservation.setSource("direct");
        reservation.setSourceName("Clenzy Booking Engine");
        reservation.setCurrency(property.getDefaultCurrency());
        reservation.setPaymentStatus(PaymentStatus.PENDING);
        reservation.setRoomRevenue(availability.subtotal());
        reservation.setCleaningFee(availability.cleaningFee());
        reservation.setTouristTaxAmount(availability.touristTax());
        reservation.setTotalPrice(totalPrice);
        reservation.setConfirmationCode(generateConfirmationCode());
        return reservation;
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

    // ─── Confirmation paiement Booking Engine (webhook Stripe) ───────────────────

    /**
     * Confirme un paiement Stripe pour une reservation booking engine.
     *
     * <p>Appele par {@link com.clenzy.controller.StripeWebhookController} sur l'evenement
     * {@code checkout.session.completed} quand {@code metadata.type=booking_engine}.</p>
     *
     * <p>Cas geres :</p>
     * <ul>
     *   <li><b>Reservation deja creee</b> (hold du create-session Embedded, ou flux
     *       {@code /reserve}) : retrouvee via le {@code sessionId}, elle est passee en
     *       CONFIRMED + PAID par {@code confirmReservationPayment} (transition gardee,
     *       wallets, factures, notifications).</li>
     *   <li><b>Fallback legacy</b> (session creee avant la retenue de dates au
     *       create-session) : revalidation de la disponibilite ET du montant paye
     *       contre le devis serveur. En cas d'indisponibilite ou de divergence de
     *       montant, AUCUNE reservation n'est creee : le paiement est rembourse
     *       automatiquement et les admins sont notifies (Z4A-SEC-01 / Z4A-BUGS-03 —
     *       plus de creation en « mode degrade »).</li>
     * </ul>
     *
     * <p><b>Idempotent</b> : si une reservation est deja PAID pour ce {@code sessionId}, on retourne
     * silencieusement sans dupliquer (Stripe peut envoyer le webhook plusieurs fois).</p>
     */
    @Transactional
    public void confirmBookingEngineCheckout(Session session) {
        String sessionId = session.getId();
        Map<String, String> metadata = session.getMetadata() != null
            ? session.getMetadata() : Collections.emptyMap();

        // ─── 1. Idempotence : reservation deja rattachee a la session ? ─────────
        Optional<Reservation> existing = reservationRepository.findByStripeSessionId(sessionId);
        if (existing.isPresent()) {
            Reservation r = existing.get();
            if (r.getPaymentStatus() == PaymentStatus.PAID) {
                log.info("Booking Engine: session {} deja confirmee pour reservation {} - skip",
                    sessionId, r.getConfirmationCode());
                return;
            }
            log.info("Booking Engine: confirmation reservation existante {} via session {}",
                r.getConfirmationCode(), sessionId);
            stripeService.confirmReservationPayment(sessionId);
            return;
        }

        // ─── 1b. Hold cree au create-session mais session non rattachee ─────────
        if (confirmPendingHoldFromMetadata(sessionId, metadata)) {
            return;
        }

        // ─── 2. Fallback legacy : session sans hold prealable ───────────────────
        WebhookBookingContext wb = parseWebhookMetadata(session, metadata);
        if (wb == null) {
            return;
        }

        Property property = propertyRepository.findBookingEngineProperty(wb.propertyId(), wb.orgId())
            .orElseThrow(() -> new IllegalStateException(
                "Booking Engine: propriete " + wb.propertyId() + " introuvable pour org " + wb.orgId()));

        OrgContext ctx = resolveOrgById(wb.orgId());
        AvailabilityResponseDto availability = checkAvailability(ctx, new AvailabilityRequestDto(
            wb.propertyId(), wb.checkIn(), wb.checkOut(), wb.guests()
        ));

        // Z4A-BUGS-03 : plus de creation en mode degrade — remboursement automatique
        if (!availability.available()) {
            refundUnhonorablePayment(sessionId, wb,
                "dates plus disponibles apres paiement (" + String.join(", ", availability.violations()) + ")");
            return;
        }

        // Z4A-SEC-01 : le montant encaisse doit correspondre au devis serveur.
        // Deux references acceptees (les sessions legacy etaient facturees hors
        // taxe de sejour) : total complet OU subtotal + menage + options.
        BigDecimal expectedTotal = availability.total().add(wb.serviceOptionsTotal());
        BigDecimal expectedExclTax = availability.subtotal().add(availability.cleaningFee())
            .add(wb.serviceOptionsTotal());
        BigDecimal stripeTotal = session.getAmountTotal() != null
            ? BigDecimal.valueOf(session.getAmountTotal()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
            : expectedTotal;
        if (stripeTotal.subtract(expectedTotal).abs().compareTo(AMOUNT_TOLERANCE) > 0
            && stripeTotal.subtract(expectedExclTax).abs().compareTo(AMOUNT_TOLERANCE) > 0) {
            refundUnhonorablePayment(sessionId, wb,
                "montant paye (" + stripeTotal + ") divergent du devis serveur (" + expectedTotal + ")");
            return;
        }

        createReservationFromWebhook(session, wb, property, availability, stripeTotal);
    }

    /**
     * Filet de securite : si l'attache du sessionId au hold a echoue au
     * create-session, on retrouve le hold via {@code metadata.reservation_id}
     * pour eviter une double creation de reservation.
     */
    private boolean confirmPendingHoldFromMetadata(String sessionId, Map<String, String> metadata) {
        String holdIdStr = metadata.get("reservation_id");
        if (holdIdStr == null || holdIdStr.isBlank()) {
            return false;
        }
        final Long holdId;
        try {
            holdId = Long.parseLong(holdIdStr);
        } catch (NumberFormatException e) {
            return false;
        }
        Optional<Reservation> hold = reservationRepository.findById(holdId);
        if (hold.isEmpty() || hold.get().getStripeSessionId() != null
            || !"pending".equalsIgnoreCase(hold.get().getStatus())) {
            return false;
        }
        Reservation reservation = hold.get();
        reservation.setStripeSessionId(sessionId);
        reservationRepository.save(reservation);
        log.warn("Booking Engine: session {} non rattachee au hold {} — rattrapage via metadata",
            sessionId, reservation.getConfirmationCode());
        stripeService.confirmReservationPayment(sessionId);
        return true;
    }

    /** Donnees extraites des metadata Stripe du flux Embedded Checkout. */
    private record WebhookBookingContext(Long propertyId, Long orgId, LocalDate checkIn,
                                         LocalDate checkOut, int guests, BigDecimal serviceOptionsTotal,
                                         List<SelectedServiceOptionDto> serviceOptions,
                                         String customerEmail, String customerName) {}

    private WebhookBookingContext parseWebhookMetadata(Session session, Map<String, String> metadata) {
        String propertyIdStr = metadata.get("property_id");
        String orgIdStr = metadata.get("organization_id");
        String checkInStr = metadata.get("check_in");
        String checkOutStr = metadata.get("check_out");
        String guestsStr = metadata.get("guests");
        if (propertyIdStr == null || orgIdStr == null
            || checkInStr == null || checkOutStr == null || guestsStr == null) {
            log.error("Booking Engine: metadata incompletes pour session {} - skip (meta={})",
                session.getId(), metadata);
            return null;
        }
        String customerName = session.getCustomerDetails() != null
            ? session.getCustomerDetails().getName() : null;
        return new WebhookBookingContext(
            Long.parseLong(propertyIdStr), Long.parseLong(orgIdStr),
            LocalDate.parse(checkInStr), LocalDate.parse(checkOutStr), Integer.parseInt(guestsStr),
            parseAmountOrZero(metadata.get("service_options_total")),
            parseServiceOptionsMetadata(metadata.get("service_options")),
            session.getCustomerEmail(), customerName);
    }

    /**
     * Deserialise les selections d'options posees en metadata Stripe par
     * {@code BookingCheckoutController} (format compact {@code id:qty,id:qty}).
     * Les entrees illisibles sont ignorees (les prix sont de toute facon
     * recalcules serveur au snapshot — Z4A-BUGS-10).
     */
    private List<SelectedServiceOptionDto> parseServiceOptionsMetadata(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<SelectedServiceOptionDto> selections = new ArrayList<>();
        for (String entry : raw.split(",")) {
            String[] parts = entry.trim().split(":");
            if (parts.length != 2) {
                continue;
            }
            try {
                selections.add(new SelectedServiceOptionDto(
                    Long.parseLong(parts[0].trim()), Integer.parseInt(parts[1].trim())));
            } catch (NumberFormatException e) {
                log.warn("Booking Engine: selection d'option illisible en metadata : '{}'", entry);
            }
        }
        return selections;
    }

    private BigDecimal parseAmountOrZero(String raw) {
        if (raw == null || raw.isBlank()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    /**
     * Cree la reservation du fallback legacy en PENDING puis delegue la transition
     * PAID + confirmed (et les effets de bord wallets/factures/notifications) a la
     * version idempotente de {@code confirmReservationPayment} (Z4A-BUGS-05).
     * En cas de conflit calendrier sous lock (race perdue), la reservation est
     * annulee et le paiement rembourse — jamais deux reservations confirmees sur
     * les memes dates.
     */
    private void createReservationFromWebhook(Session session, WebhookBookingContext wb,
            Property property, AvailabilityResponseDto availability, BigDecimal stripeTotal) {
        String[] nameParts = splitName(wb.customerName() != null ? wb.customerName() : "Guest");
        Guest guest = guestService.findOrCreate(
            nameParts[0], nameParts[1], wb.customerEmail(), null,
            GuestChannel.DIRECT, null, wb.orgId());

        Reservation reservation = buildPendingReservation(
            property, guest, wb.orgId(),
            wb.customerName() != null ? wb.customerName() : nameParts[0],
            wb.guests(), wb.checkIn(), wb.checkOut(), availability, stripeTotal);
        reservation.setStripeSessionId(session.getId());
        reservation = reservationRepository.save(reservation);

        try {
            calendarEngine.book(wb.propertyId(), wb.checkIn(), wb.checkOut(),
                reservation.getId(), wb.orgId(), "direct", "booking-engine-webhook");
        } catch (CalendarConflictException | RestrictionViolationException e) {
            reservation.setStatus("cancelled");
            reservation.setPaymentStatus(PaymentStatus.CANCELLED);
            reservationRepository.save(reservation);
            refundUnhonorablePayment(session.getId(), wb, "conflit calendrier au blocage des dates");
            return;
        }

        // Z4A-BUGS-10 : snapshot des options de service en lignes de reservation
        // (serviceOptionsTotal + ReservationServiceItem) — le fallback legacy
        // n'enregistrait que le totalPrice global, laissant un ecart non ventile.
        snapshotServiceOptions(reservation, wb.serviceOptions(), wb.guests(),
            wb.checkIn(), wb.checkOut(), wb.orgId());

        log.info("Booking Engine: reservation {} creee via webhook (session={}, property={}, total={})",
            reservation.getConfirmationCode(), session.getId(), wb.propertyId(), stripeTotal);
        stripeService.confirmReservationPayment(session.getId());
    }

    /**
     * Paiement recu pour une session qui ne peut plus aboutir (dates indisponibles,
     * montant divergent, conflit calendrier) : remboursement automatique + alerte
     * admins (Z4A-BUGS-03). Aucune reservation confirmee n'est creee.
     *
     * <p>L'appel Stripe (HTTP externe) et la notification sont executes APRES le
     * commit de la transaction du webhook (reliquat revue A3) : une exception
     * traversant un proxy {@code @Transactional} interne marquerait sinon la
     * transaction rollback-only alors que le catch l'avale — le commit final
     * leverait une {@code UnexpectedRollbackException} silencieuse et
     * l'annulation de la reservation serait perdue.</p>
     */
    private void refundUnhonorablePayment(String sessionId, WebhookBookingContext wb, String reason) {
        log.error("Booking Engine: paiement non honorable - session {}, property {}, dates {} → {} : {}. "
            + "Remboursement automatique en cours.",
            sessionId, wb.propertyId(), wb.checkIn(), wb.checkOut(), reason);
        Long orgId = wb.orgId();
        runAfterCommit(() -> {
            try {
                stripeService.refundCheckoutSessionPayment(sessionId, reason);
            } catch (Exception e) {
                log.error("Booking Engine: remboursement automatique impossible pour session {} — "
                    + "intervention manuelle requise : {}", sessionId, e.getMessage(), e);
            }
            try {
                notificationService.notifyAdminsAndManagersByOrgId(orgId,
                    NotificationKey.PAYMENT_REFUND_INITIATED,
                    "Paiement booking engine rembourse",
                    "Un paiement recu via le booking engine n'a pas pu etre honore (" + reason + "). "
                        + "Remboursement automatique declenche pour la session " + sessionId + ".",
                    "/reservations");
            } catch (Exception e) {
                log.warn("Booking Engine: notification remboursement impossible : {}", e.getMessage());
            }
        });
    }

    /**
     * Execute {@code action} apres le commit de la transaction courante, ou
     * immediatement s'il n'y a pas de transaction active (tests unitaires,
     * appels hors contexte transactionnel).
     */
    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
            return;
        }
        action.run();
    }

    /**
     * Variante de {@link #resolveOrg(String)} utilisant directement l'orgId.
     * Utilisee par les webhooks et le create-session Embedded Checkout, ou l'org
     * est connue par son id (metadata Stripe / propriete).
     */
    public OrgContext resolveOrgById(Long orgId) {
        Organization org = organizationRepository.findById(orgId)
            .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable : " + orgId));
        BookingEngineConfig config = configRepository.findAllByOrganizationId(orgId)
            .stream().filter(BookingEngineConfig::isEnabled).findFirst()
            .orElseThrow(() -> new IllegalStateException(
                "Booking Engine desactive pour l'organisation " + orgId));
        return new OrgContext(org, config);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private String generateConfirmationCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder("RES-");
        java.security.SecureRandom random = new java.security.SecureRandom();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    // ─── Reviews ───────────────────────────────────────────────────────────────

    public org.springframework.data.domain.Page<PublicReviewDto> getPublicReviews(
            OrgContext ctx, Long propertyId, org.springframework.data.domain.Pageable pageable) {
        if (propertyId != null) {
            return guestReviewRepository.findPublicByPropertyId(propertyId, ctx.orgId(), pageable)
                    .map(PublicReviewDto::from);
        }
        return guestReviewRepository.findPublicByOrgId(ctx.orgId(), pageable)
                .map(PublicReviewDto::from);
    }

    public ReviewStatsDto getReviewStats(OrgContext ctx, Long propertyId) {
        final double avg;
        final long count;

        if (propertyId != null) {
            Double rawAvg = guestReviewRepository.averagePublicRatingByPropertyId(propertyId, ctx.orgId());
            avg = rawAvg != null ? Math.round(rawAvg * 10.0) / 10.0 : 0.0;
            count = guestReviewRepository.countPublicByPropertyId(propertyId, ctx.orgId());
        } else {
            Double rawAvg = guestReviewRepository.averagePublicRatingByOrgId(ctx.orgId());
            avg = rawAvg != null ? Math.round(rawAvg * 10.0) / 10.0 : 0.0;
            count = guestReviewRepository.countPublicByOrgId(ctx.orgId());
        }

        // Distribution par étoiles (toujours par propriété ou global)
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int i = 1; i <= 5; i++) distribution.put(i, 0L);
        // Pour la distribution, on peut la calculer si besoin, mais pour l'instant avg + count suffit
        return new ReviewStatsDto(avg, count, distribution);
    }

    private String[] splitName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return new String[]{"Guest", ""};
        }
        String[] parts = fullName.trim().split("\\s+", 2);
        return parts.length == 2 ? parts : new String[]{parts[0], ""};
    }
}
