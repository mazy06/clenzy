package com.clenzy.integration.direct.service;

import com.clenzy.integration.direct.config.DirectBookingConfig;
import com.clenzy.integration.direct.dto.*;
import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import com.clenzy.integration.direct.model.PromoCode;
import com.clenzy.integration.direct.repository.DirectBookingConfigRepository;
import com.clenzy.integration.direct.repository.PromoCodeRepository;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.model.Reservation;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.PriceEngine;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service principal pour les reservations directes via widget.
 *
 * Orchestre la verification de disponibilite, le calcul de prix,
 * la creation de reservation, l'integration Stripe et les codes promo.
 *
 * <p><b>Transactions</b> (regle audit n°2 — jamais d'appel HTTP externe dans une
 * transaction DB) : les transactions sont portees par les methodes, pas par la
 * classe. {@link #createBooking} orchestre HORS transaction : creation de la resa
 * (verrous CalendarDay + save) en transaction courte via le proxy {@link #self},
 * puis creation du PaymentIntent Stripe apres commit.</p>
 */
@Service
public class DirectBookingService {

    private static final Logger log = LoggerFactory.getLogger(DirectBookingService.class);

    private final DirectBookingConfig config;
    private final DirectBookingConfigRepository configRepository;
    private final PromoCodeRepository promoCodeRepository;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final CalendarEngine calendarEngine;
    private final PriceEngine priceEngine;
    private final StripeGateway stripeGateway;
    /** Proxy Spring de ce bean : l'auto-invocation directe d'une methode
     *  {@code @Transactional} contournerait le proxy (T-BP-06, pattern ICalImportService). */
    private final ObjectProvider<DirectBookingService> self;

    public DirectBookingService(DirectBookingConfig config,
                                 DirectBookingConfigRepository configRepository,
                                 PromoCodeRepository promoCodeRepository,
                                 PropertyRepository propertyRepository,
                                 ReservationRepository reservationRepository,
                                 CalendarEngine calendarEngine,
                                 PriceEngine priceEngine,
                                 StripeGateway stripeGateway,
                                 ObjectProvider<DirectBookingService> self) {
        this.config = config;
        this.configRepository = configRepository;
        this.promoCodeRepository = promoCodeRepository;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.calendarEngine = calendarEngine;
        this.priceEngine = priceEngine;
        this.stripeGateway = stripeGateway;
        this.self = self;
    }

    // ----------------------------------------------------------------
    // Disponibilite
    // ----------------------------------------------------------------

    /**
     * Verifie la disponibilite et calcule le prix pour les dates demandees.
     */
    @Transactional(readOnly = true)
    public DirectAvailabilityResponse checkAvailability(DirectAvailabilityRequest request, Long orgId) {
        log.debug("checkAvailability: propertyId={}, checkIn={}, checkOut={}, orgId={}",
                request.propertyId(), request.checkIn(), request.checkOut(), orgId);

        final String currency = config.getDefaultCurrency();

        // Valider les dates
        if (!request.checkOut().isAfter(request.checkIn())) {
            return DirectAvailabilityResponse.unavailable(request.propertyId(), currency);
        }

        // Verifier la fenetre de reservation (avance min/max)
        long daysUntilCheckIn = ChronoUnit.DAYS.between(LocalDate.now(), request.checkIn());
        if (daysUntilCheckIn < config.getMinAdvanceDays() || daysUntilCheckIn > config.getMaxAdvanceDays()) {
            return DirectAvailabilityResponse.unavailable(request.propertyId(), currency);
        }

        // Charger la propriete
        Property property = propertyRepository.findById(request.propertyId()).orElse(null);
        if (property == null || !property.isActive()) {
            return DirectAvailabilityResponse.unavailable(request.propertyId(), currency);
        }

        // Verifier la capacite
        if (property.getMaxGuests() != null && request.numberOfGuests() > property.getMaxGuests()) {
            return DirectAvailabilityResponse.unavailable(request.propertyId(), currency);
        }

        // Verifier la configuration direct booking pour cette propriete
        Optional<DirectBookingConfiguration> dbConfig =
                configRepository.findEnabledByPropertyId(request.propertyId(), orgId);
        if (dbConfig.isEmpty()) {
            return DirectAvailabilityResponse.unavailable(request.propertyId(), currency);
        }

        // Verifier la disponibilite via le CalendarEngine (pas de conflits)
        long conflicts = countCalendarConflicts(request.propertyId(), request.checkIn(), request.checkOut(), orgId);
        if (conflicts > 0) {
            return DirectAvailabilityResponse.unavailable(request.propertyId(), currency);
        }

        // Calculer le prix
        int nights = (int) ChronoUnit.DAYS.between(request.checkIn(), request.checkOut());
        Map<LocalDate, BigDecimal> priceMap = priceEngine.resolvePriceRange(
                request.propertyId(), request.checkIn(), request.checkOut(), orgId);

        BigDecimal totalPrice = computeTotalPrice(priceMap, property, request.checkIn(), request.checkOut());
        BigDecimal pricePerNight = nights > 0
                ? totalPrice.divide(BigDecimal.valueOf(nights), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return new DirectAvailabilityResponse(
                true,
                request.propertyId(),
                totalPrice,
                pricePerNight,
                currency,
                nights,
                1,  // minStay par defaut
                365, // maxStay par defaut
                List.of()
        );
    }

    // ----------------------------------------------------------------
    // Reservation
    // ----------------------------------------------------------------

    /**
     * Cree une reservation directe.
     * Gere le flux avec ou sans paiement Stripe selon la configuration.
     *
     * <p>Orchestrateur volontairement NON transactionnel (regle audit n°2) :
     * la creation (verrous CalendarDay via {@code calendarEngine.book} + save)
     * est commitee dans une transaction courte via le proxy {@link #self}, PUIS
     * le PaymentIntent Stripe est cree hors transaction — les verrous calendrier
     * et la connexion DB ne sont jamais tenus pendant l'appel HTTP Stripe.</p>
     */
    public DirectBookingResponse createBooking(DirectBookingRequest request, Long orgId) {
        log.info("createBooking: propertyId={}, checkIn={}, checkOut={}, guest={} {}, orgId={}",
                request.propertyId(), request.checkIn(), request.checkOut(),
                request.guestFirstName(), request.guestLastName(), orgId);

        // Transaction courte : validation + prix serveur + book calendrier + save.
        BookingCreationOutcome outcome = self.getObject().createBookingTransactional(request, orgId);
        if (!outcome.paymentRequired()) {
            return outcome.response();
        }

        // Flux avec paiement : appel Stripe HORS transaction (apres commit).
        return createBookingWithPayment(outcome.reservation(), outcome.property(),
                outcome.totalPrice(), request.currency(), outcome.bookingId());
    }

    /**
     * Transaction courte de creation : validation, calcul de prix cote serveur,
     * code promo, reservation des jours calendrier et persistance de la resa.
     * NE FAIT AUCUN appel Stripe. Public uniquement pour etre invoquee via le
     * proxy transactionnel ({@link #self}) — ne pas appeler directement.
     */
    @Transactional
    public BookingCreationOutcome createBookingTransactional(DirectBookingRequest request, Long orgId) {
        // Valider les dates
        validateBookingDates(request.checkIn(), request.checkOut());

        // Charger la propriete
        Property property = propertyRepository.findById(request.propertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + request.propertyId()));

        // Verifier la capacite
        if (property.getMaxGuests() != null && request.numberOfGuests() > property.getMaxGuests()) {
            throw new IllegalArgumentException("Nombre de voyageurs depasse la capacite maximale: " + property.getMaxGuests());
        }

        // Verifier la config direct booking
        DirectBookingConfiguration dbConfig = configRepository
                .findEnabledByPropertyId(request.propertyId(), orgId)
                .orElseThrow(() -> new IllegalStateException(
                        "Reservations directes non activees pour la propriete " + request.propertyId()));

        // Calculer le prix total
        int nights = (int) ChronoUnit.DAYS.between(request.checkIn(), request.checkOut());
        Map<LocalDate, BigDecimal> priceMap = priceEngine.resolvePriceRange(
                request.propertyId(), request.checkIn(), request.checkOut(), orgId);
        BigDecimal totalPrice = computeTotalPrice(priceMap, property, request.checkIn(), request.checkOut());

        // Appliquer le code promo si fourni
        BigDecimal discount = BigDecimal.ZERO;
        if (request.promoCode() != null && !request.promoCode().isBlank()) {
            discount = applyPromoDiscount(request.promoCode(), request.propertyId(), totalPrice, nights, orgId);
            totalPrice = totalPrice.subtract(discount);
            if (totalPrice.compareTo(BigDecimal.ZERO) < 0) {
                totalPrice = BigDecimal.ZERO;
            }
        }

        // Creer la reservation dans le systeme
        String guestFullName = request.guestFirstName() + " " + request.guestLastName();
        Reservation reservation = new Reservation(property, guestFullName,
                request.checkIn(), request.checkOut(), "pending", "DIRECT");
        reservation.setOrganizationId(orgId);
        reservation.setGuestCount(request.numberOfGuests());
        // Ventilation adultes/enfants (0314) : numberOfGuests est le total, dont
        // numberOfChildren mineurs → adultes taxables = total - enfants (borne a 0).
        int directChildren = Math.max(0, request.numberOfChildren());
        reservation.setChildrenCount(directChildren);
        reservation.setAdultsCount(Math.max(0, request.numberOfGuests() - directChildren));
        reservation.setTotalPrice(totalPrice);
        reservation.setSourceName("Direct Booking Widget");
        reservation.setNotes(buildReservationNotes(request));
        reservation.setConfirmationCode(generateConfirmationCode());

        // Reserver les jours dans le calendrier
        calendarEngine.book(property.getId(), request.checkIn(), request.checkOut(),
                null, orgId, "DIRECT", "system");

        reservation = reservationRepository.save(reservation);

        // Lier la reservation aux CalendarDays
        calendarEngine.linkReservation(property.getId(), request.checkIn(), request.checkOut(),
                reservation.getId(), orgId);

        final String bookingId = reservation.getConfirmationCode();
        final boolean requirePayment = resolveRequirePayment(dbConfig);
        final boolean autoConfirm = resolveAutoConfirm(dbConfig);

        log.info("createBooking: reservation {} creee (requirePayment={}, autoConfirm={})",
                bookingId, requirePayment, autoConfirm);

        // Flux avec paiement Stripe : le PaymentIntent sera cree par l'orchestrateur
        // APRES le commit de cette transaction (jamais d'appel Stripe ici).
        if (requirePayment && config.isStripeEnabled()) {
            return BookingCreationOutcome.paymentRequired(reservation, property, totalPrice, bookingId);
        }

        // Flux sans paiement : auto-confirm ou en attente
        if (autoConfirm) {
            reservation.setStatus("confirmed");
            reservationRepository.save(reservation);
            return BookingCreationOutcome.completed(DirectBookingResponse.confirmed(
                    bookingId, property.getName(),
                    request.checkIn(), request.checkOut(), totalPrice, request.currency(),
                    "Reservation confirmee"));
        }

        return BookingCreationOutcome.completed(DirectBookingResponse.pending(
                bookingId, property.getName(),
                request.checkIn(), request.checkOut(), totalPrice, request.currency(),
                "Reservation en attente de confirmation par le proprietaire"));
    }

    /**
     * Resultat de la transaction courte de creation ({@link #createBookingTransactional}) :
     * soit une reponse terminale (flux sans paiement), soit les donnees necessaires
     * a la creation du PaymentIntent HORS transaction.
     */
    public record BookingCreationOutcome(boolean paymentRequired, DirectBookingResponse response,
                                         Reservation reservation, Property property,
                                         BigDecimal totalPrice, String bookingId) {

        static BookingCreationOutcome completed(DirectBookingResponse response) {
            return new BookingCreationOutcome(false, response, null, null, null, null);
        }

        static BookingCreationOutcome paymentRequired(Reservation reservation, Property property,
                                                      BigDecimal totalPrice, String bookingId) {
            return new BookingCreationOutcome(true, null, reservation, property, totalPrice, bookingId);
        }
    }

    /**
     * Confirmation cote endpoint public.
     *
     * I1-OTA-01 : un client ne peut JAMAIS confirmer une reservation PAYANTE
     * depuis l'endpoint public — sinon il suffirait d'appeler /confirm sans payer.
     * La confirmation d'une resa payante vient UNIQUEMENT du webhook Stripe
     * ({@link #confirmPaidBookingFromWebhook}) apres paiement reussi.
     *
     * Cette methode n'autorise donc QUE le flux sans paiement (proprietes dont la
     * config direct booking a {@code requirePayment=false}, OU Stripe desactive).
     * Tout le reste est refuse ({@link AccessDeniedException} -> HTTP 403).
     */
    @Transactional
    public DirectBookingResponse confirmBooking(String bookingId, Long orgId) {
        log.info("confirmBooking (public): bookingId={}, orgId={}", bookingId, orgId);

        Reservation reservation = findReservationByConfirmationCode(bookingId, orgId);

        if (isPaymentRequired(reservation)) {
            log.warn("confirmBooking (public) REFUSE pour resa payante {} (org={}) : "
                    + "la confirmation doit venir du webhook Stripe", bookingId, orgId);
            throw new AccessDeniedException(
                    "La confirmation d'une reservation payante ne peut pas etre declenchee "
                    + "depuis le client : elle est faite automatiquement apres paiement.");
        }

        reservation.setStatus("confirmed");
        reservationRepository.save(reservation);

        return DirectBookingResponse.confirmed(bookingId, reservation.getProperty().getName(),
                reservation.getCheckIn(), reservation.getCheckOut(),
                reservation.getTotalPrice(), config.getDefaultCurrency(),
                "Reservation confirmee avec succes");
    }

    /**
     * Confirmation declenchee par le webhook Stripe (payment_intent.succeeded,
     * metadata type=direct_booking) APRES paiement reussi. Le webhook a deja
     * verifie la signature Stripe (StripeWebhookController) : c'est la seule voie
     * de confirmation d'une reservation directe payante (I1-OTA-01).
     *
     * Idempotent : si la resa est deja 'confirmed', ne re-sauvegarde pas
     * (une re-livraison du webhook ne produit pas d'effet).
     */
    @Transactional
    public void confirmPaidBookingFromWebhook(String bookingId, Long orgId) {
        log.info("confirmPaidBookingFromWebhook: bookingId={}, orgId={}", bookingId, orgId);

        Reservation reservation = findReservationByConfirmationCode(bookingId, orgId);
        if ("confirmed".equals(reservation.getStatus())) {
            log.debug("confirmPaidBookingFromWebhook: resa {} deja confirmee, no-op", bookingId);
            return;
        }
        reservation.setStatus("confirmed");
        reservationRepository.save(reservation);
        log.info("Reservation directe {} confirmee via webhook Stripe (org={})", bookingId, orgId);
    }

    /**
     * Une reservation directe est "payante" si la config direct booking de sa
     * propriete exige le paiement ET que Stripe est active globalement
     * (meme condition que dans {@link #createBooking}). Si la config a disparu,
     * on considere par prudence (fail-closed) que le paiement etait requis.
     */
    private boolean isPaymentRequired(Reservation reservation) {
        if (!config.isStripeEnabled()) {
            return false;
        }
        Long propertyId = reservation.getProperty() != null ? reservation.getProperty().getId() : null;
        Long orgId = reservation.getOrganizationId();
        if (propertyId == null || orgId == null) {
            return true;
        }
        return configRepository.findEnabledByPropertyId(propertyId, orgId)
                .map(DirectBookingConfiguration::isRequirePayment)
                .orElse(true);
    }

    /**
     * Annule une reservation directe.
     */
    @Transactional
    public void cancelBooking(String bookingId, String reason, Long orgId) {
        log.info("cancelBooking: bookingId={}, reason={}, orgId={}", bookingId, reason, orgId);

        Reservation reservation = findReservationByConfirmationCode(bookingId, orgId);
        reservation.markCancelled();
        reservation.setNotes(reservation.getNotes() != null
                ? reservation.getNotes() + "\nAnnulation: " + reason
                : "Annulation: " + reason);
        reservationRepository.save(reservation);

        // Liberer les jours dans le calendrier
        calendarEngine.cancel(reservation.getId(), orgId, "system");
    }

    // ----------------------------------------------------------------
    // Codes promo
    // ----------------------------------------------------------------

    /**
     * Valide un code promo et retourne ses details.
     */
    @Transactional(readOnly = true)
    public DirectPromoCodeDto applyPromoCode(String code, Long propertyId, Long orgId) {
        PromoCode promo = promoCodeRepository.findByCodeAndOrganizationId(code, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Code promo invalide: " + code));

        if (!promo.isValidAt(LocalDate.now())) {
            throw new IllegalArgumentException("Code promo expire ou utilisation maximale atteinte");
        }

        if (!promo.appliesTo(propertyId)) {
            throw new IllegalArgumentException("Code promo non applicable a cette propriete");
        }

        return new DirectPromoCodeDto(
                promo.getCode(),
                promo.getDiscountType().name(),
                promo.getDiscountValue(),
                promo.getValidFrom(),
                promo.getValidUntil(),
                promo.getMinNights(),
                promo.getMaxUses(),
                promo.getCurrentUses()
        );
    }

    // ----------------------------------------------------------------
    // Resume propriete
    // ----------------------------------------------------------------

    /**
     * Retourne un resume de la propriete pour l'affichage dans le widget.
     *
     * I1-OTA-03 : endpoint public, le filtre tenant Hibernate n'est pas actif
     * et {@code findById} contournerait l'isolation org. On exige donc l'orgId
     * et on verifie qu'une DirectBookingConfiguration ENABLED existe pour le
     * couple (propertyId, orgId) AVANT d'exposer la moindre donnee. Sans config
     * active pour cette org, on repond comme si la propriete etait introuvable
     * (pas de fuite cross-org, pas d'enumeration d'ID).
     */
    @Transactional(readOnly = true)
    public DirectPropertySummaryDto getPropertySummary(Long propertyId, Long orgId) {
        if (configRepository.findEnabledByPropertyId(propertyId, orgId).isEmpty()) {
            log.warn("getPropertySummary refuse : pas de config direct booking ENABLED pour "
                    + "propertyId={} orgId={}", propertyId, orgId);
            throw new IllegalArgumentException("Propriete introuvable: " + propertyId);
        }

        Property property = propertyRepository.findById(propertyId)
                .filter(p -> orgId.equals(p.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + propertyId));

        List<String> photoUrls = property.getPhotos().stream()
                .map(PropertyPhoto::getUrl)
                .collect(Collectors.toList());

        List<String> amenitiesList = property.getAmenities() != null
                ? Arrays.asList(property.getAmenities().split(","))
                : List.of();

        double lat = property.getLatitude() != null ? property.getLatitude().doubleValue() : 0.0;
        double lng = property.getLongitude() != null ? property.getLongitude().doubleValue() : 0.0;

        return new DirectPropertySummaryDto(
                property.getId(),
                property.getName(),
                property.getDescription(),
                property.getType() != null ? property.getType().name() : null,
                property.getMaxGuests() != null ? property.getMaxGuests() : 0,
                property.getBedroomCount() != null ? property.getBedroomCount() : 0,
                property.getBathroomCount() != null ? property.getBathroomCount() : 0,
                property.getNightlyPrice() != null ? property.getNightlyPrice() : BigDecimal.ZERO,
                config.getDefaultCurrency(),
                photoUrls,
                amenitiesList,
                property.getAddress(),
                property.getCity(),
                property.getCountry(),
                lat,
                lng,
                0.0,  // averageRating : a implementer quand le systeme d'avis sera en place
                0     // numberOfReviews : idem
        );
    }

    // ================================================================
    // Methodes internes
    // ================================================================

    private void validateBookingDates(LocalDate checkIn, LocalDate checkOut) {
        if (!checkOut.isAfter(checkIn)) {
            throw new IllegalArgumentException("La date de check-out doit etre apres le check-in");
        }
        long daysUntilCheckIn = ChronoUnit.DAYS.between(LocalDate.now(), checkIn);
        if (daysUntilCheckIn < config.getMinAdvanceDays()) {
            throw new IllegalArgumentException(
                    "Reservation trop proche : minimum " + config.getMinAdvanceDays() + " jour(s) a l'avance");
        }
        if (daysUntilCheckIn > config.getMaxAdvanceDays()) {
            throw new IllegalArgumentException(
                    "Reservation trop lointaine : maximum " + config.getMaxAdvanceDays() + " jours a l'avance");
        }
    }

    /**
     * Compte les conflits calendrier pour une plage [checkIn, checkOut).
     * Utilise une query directe pour eviter de passer par le lock du CalendarEngine en lecture.
     */
    private long countCalendarConflicts(Long propertyId, LocalDate checkIn, LocalDate checkOut, Long orgId) {
        // Delegue au CalendarEngine via une verification de reservations existantes
        List<Reservation> existing = reservationRepository.findByPropertyId(propertyId, orgId);
        return existing.stream()
                .filter(r -> !"cancelled".equals(r.getStatus()))
                .filter(r -> r.getCheckIn().isBefore(checkOut) && r.getCheckOut().isAfter(checkIn))
                .count();
    }

    /**
     * Calcule le prix total a partir du PriceEngine, avec fallback sur le prix de la propriete.
     */
    private BigDecimal computeTotalPrice(Map<LocalDate, BigDecimal> priceMap, Property property,
                                          LocalDate checkIn, LocalDate checkOut) {
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal fallbackPrice = property.getNightlyPrice() != null
                ? property.getNightlyPrice()
                : BigDecimal.ZERO;

        for (LocalDate date = checkIn; date.isBefore(checkOut); date = date.plusDays(1)) {
            BigDecimal nightPrice = priceMap.getOrDefault(date, fallbackPrice);
            total = total.add(nightPrice);
        }
        return total;
    }

    /**
     * Applique une reduction promo et incremente le compteur d'utilisation.
     */
    private BigDecimal applyPromoDiscount(String code, Long propertyId,
                                           BigDecimal totalPrice, int nights, Long orgId) {
        Optional<PromoCode> promoOpt = promoCodeRepository.findByCodeAndOrganizationId(code, orgId);
        if (promoOpt.isEmpty()) {
            log.warn("Code promo inconnu : {}", code);
            return BigDecimal.ZERO;
        }

        PromoCode promo = promoOpt.get();
        if (!promo.isValidAt(LocalDate.now()) || !promo.appliesTo(propertyId)) {
            log.warn("Code promo non applicable : {} (valid={}, appliesTo={})",
                    code, promo.isValidAt(LocalDate.now()), promo.appliesTo(propertyId));
            return BigDecimal.ZERO;
        }

        if (promo.getMinNights() > 0 && nights < promo.getMinNights()) {
            log.debug("Code promo {} : minimum {} nuits requis, {} reservees", code, promo.getMinNights(), nights);
            return BigDecimal.ZERO;
        }

        BigDecimal discount = promo.computeDiscount(totalPrice);
        promo.setCurrentUses(promo.getCurrentUses() + 1);
        promoCodeRepository.save(promo);

        log.info("Code promo {} applique : reduction de {} {}", code, discount, config.getDefaultCurrency());
        return discount;
    }

    /**
     * Cree le PaymentIntent Stripe pour une reservation deja commitee.
     * Toujours appelee HORS transaction (regle audit n°2) : la resa et les
     * verrous calendrier sont commites, l'appel HTTP ne tient aucune ressource DB.
     */
    private DirectBookingResponse createBookingWithPayment(Reservation reservation, Property property,
                                                            BigDecimal totalPrice, String currency,
                                                            String bookingId) {
        try {
            // Montant en centimes pour Stripe (HALF_UP + controle d'overflow, cf. StripeAmounts)
            long amountInCents = StripeAmounts.toMinorUnits(totalPrice);

            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                    .setAmount(amountInCents)
                    .setCurrency(currency.toLowerCase())
                    .setDescription("Reservation " + bookingId + " - " + property.getName())
                    // type=direct_booking : route le webhook payment_intent.succeeded vers
                    // confirmPaidBookingFromWebhook. La confirmation d'une reservation payante
                    // ne vient JAMAIS du client (I1-OTA-01) : seul le webhook Stripe, apres
                    // paiement reussi et verification de signature, fait passer la resa en
                    // 'confirmed'. org_id permet de re-scoper la lecture cross-org du webhook.
                    .putMetadata("type", "direct_booking")
                    .putMetadata("booking_id", bookingId)
                    .putMetadata("org_id", String.valueOf(reservation.getOrganizationId()))
                    .putMetadata("property_id", String.valueOf(property.getId()))
                    .putMetadata("reservation_id", String.valueOf(reservation.getId()))
                    .build();

            // Cle API portee par le gateway (RequestOptions par appel) : l'ancien appel
            // statique dependait du Stripe.apiKey global supprime par l'audit T-SOLID-3.
            // Idempotency key stable par reservation : un retry reseau ne cree jamais
            // deux PaymentIntents pour la meme resa.
            PaymentIntent intent = stripeGateway.createPaymentIntent(params, "direct-booking-" + bookingId);

            log.info("Stripe PaymentIntent cree : {} pour reservation {}", intent.getId(), bookingId);

            return DirectBookingResponse.paymentRequired(bookingId, property.getName(),
                    reservation.getCheckIn(), reservation.getCheckOut(),
                    totalPrice, currency, intent.getId(), intent.getClientSecret(),
                    "Paiement requis pour confirmer la reservation");

        } catch (Exception e) {
            log.error("Erreur creation PaymentIntent Stripe pour reservation {}: {}", bookingId, e.getMessage(), e);
            // Echec Stripe APRES le commit de la resa : aucun client_secret n'a ete
            // remis au guest, personne ne peut payer → il est sur de compenser en
            // annulant la resa et en liberant le calendrier (tx courte dediee),
            // ce qui rend le "Veuillez reessayer" reellement possible.
            compensateFailedPaymentSetup(bookingId, reservation.getOrganizationId());
            return DirectBookingResponse.pending(bookingId, property.getName(),
                    reservation.getCheckIn(), reservation.getCheckOut(),
                    totalPrice, currency,
                    "Erreur de paiement. Veuillez reessayer ou contacter le proprietaire.");
        }
    }

    /**
     * Compensation best-effort apres un echec de creation du PaymentIntent
     * (post-commit) : annule la resa et libere les jours calendrier via
     * {@link #cancelBooking} (transaction courte via le proxy {@link #self}).
     * Si la compensation echoue a son tour, la resa reste 'pending' et visible
     * par l'hote — annulation manuelle requise (pas de filet scheduler pour les
     * resas DIRECT : leur paymentStatus est null, hors perimetre de
     * PendingReservationCleanupScheduler.findUnpaidHolds).
     */
    private void compensateFailedPaymentSetup(String bookingId, Long orgId) {
        try {
            self.getObject().cancelBooking(bookingId,
                    "Echec de l'initialisation du paiement Stripe", orgId);
        } catch (Exception e) {
            log.error("Compensation impossible pour la reservation directe {} : {} — "
                    + "la resa reste 'pending' et bloque le calendrier, annulation manuelle requise",
                    bookingId, e.getMessage(), e);
        }
    }

    private Reservation findReservationByConfirmationCode(String confirmationCode, Long orgId) {
        return reservationRepository.findAll().stream()
                .filter(r -> confirmationCode.equals(r.getConfirmationCode()))
                .filter(r -> orgId.equals(r.getOrganizationId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Reservation introuvable: " + confirmationCode));
    }

    private boolean resolveRequirePayment(DirectBookingConfiguration dbConfig) {
        return dbConfig.isRequirePayment();
    }

    private boolean resolveAutoConfirm(DirectBookingConfiguration dbConfig) {
        return dbConfig.isAutoConfirm();
    }

    private String buildReservationNotes(DirectBookingRequest request) {
        StringBuilder notes = new StringBuilder();
        notes.append("Source: Direct Booking Widget\n");
        notes.append("Email: ").append(request.guestEmail()).append("\n");
        if (request.guestPhone() != null && !request.guestPhone().isBlank()) {
            notes.append("Telephone: ").append(request.guestPhone()).append("\n");
        }
        notes.append("Voyageurs: ").append(request.numberOfGuests());
        if (request.numberOfChildren() > 0) {
            notes.append(" (dont ").append(request.numberOfChildren()).append(" enfant(s))");
        }
        notes.append("\n");
        if (request.specialRequests() != null && !request.specialRequests().isBlank()) {
            notes.append("Demandes speciales: ").append(request.specialRequests()).append("\n");
        }
        if (request.promoCode() != null && !request.promoCode().isBlank()) {
            notes.append("Code promo: ").append(request.promoCode()).append("\n");
        }
        return notes.toString();
    }

    private String generateConfirmationCode() {
        return "DB-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
