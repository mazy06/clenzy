package com.clenzy.service.agent.supervision;

import com.clenzy.booking.service.BookingBalanceService;
import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.model.YieldAdjustment;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.repository.YieldAdjustmentRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.EmailService;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.SearchCacheInvalidator;
import com.clenzy.service.SecurityDepositPaymentService;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.util.StringUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Exécute l'action portée par une suggestion actionnable (Phase B + vague 3).
 *
 * <p>Deux familles d'actions (cf. {@link #hasExternalEffect}) :</p>
 * <ul>
 *   <li><b>Écritures DB uniquement</b> (PRICE_DROP, CALENDAR_BLOCK) : appelées DANS
 *       la transaction d'application (après la transition atomique
 *       {@code PENDING → APPLIED}) — un échec annule la transition ;</li>
 *   <li><b>Effet externe Stripe</b> (DEPOSIT_REFUND / DEPOSIT_RELEASE) : appelées
 *       HORS transaction par {@link SupervisionSuggestionService#apply} (règle audit
 *       n°2), compensation {@code APPLIED → PENDING} en cas d'échec.</li>
 * </ul>
 *
 * <p>Règle absolue n°1 (argent) : tout ce qui est débité/libéré est RE-résolu au
 * moment de l'apply depuis l'état métier courant — le montant porté par la
 * suggestion n'est qu'indicatif et n'est jamais appliqué aveuglément.</p>
 */
@Service
public class SuggestionActionExecutor {

    private static final Logger log = LoggerFactory.getLogger(SuggestionActionExecutor.class);
    private static final String OVERRIDE_SOURCE = "SUPERVISION_PRICE_DROP";
    /** Garde-fou : une baisse proposée reste bornée (aucun tarif absurde). */
    private static final int MAX_PERCENT = 90;
    /** Source des jours bloqués par une suggestion F6c (visible calendrier). */
    static final String CALENDAR_BLOCK_SOURCE = "SUPERVISION";
    static final int DEFAULT_BLOCK_DAYS = 7;
    static final int MAX_BLOCK_DAYS = 30;
    /** Source des overrides yield v1 (partagée avec {@code YieldRuleEngine}). */
    static final String YIELD_OVERRIDE_SOURCE = "YIELD_RULE";
    /** Garde-fou dur à l'apply yield : |percent| borné, fenêtre bornée. */
    static final BigDecimal MAX_YIELD_PERCENT = BigDecimal.valueOf(50);
    static final int MAX_YIELD_WINDOW_DAYS = 366;
    static final ZoneId DEFAULT_PROPERTY_ZONE = ZoneId.of("Europe/Paris");

    private final PriceEngine priceEngine;
    private final RateOverrideRepository rateOverrideRepository;
    private final PropertyRepository propertyRepository;
    private final SearchCacheInvalidator searchCacheInvalidator;
    private final SecurityDepositRepository securityDepositRepository;
    private final SecurityDepositPaymentService securityDepositPaymentService;
    private final CalendarEngine calendarEngine;
    private final CalendarDayRepository calendarDayRepository;
    private final YieldAdjustmentRepository yieldAdjustmentRepository;
    private final ServiceRequestService serviceRequestService;
    private final ReservationRepository reservationRepository;
    private final BookingBalanceService bookingBalanceService;
    private final EmailService emailService;
    private final ReviewReplyDraftService reviewReplyDraftService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public SuggestionActionExecutor(PriceEngine priceEngine,
                                    RateOverrideRepository rateOverrideRepository,
                                    PropertyRepository propertyRepository,
                                    SearchCacheInvalidator searchCacheInvalidator,
                                    SecurityDepositRepository securityDepositRepository,
                                    SecurityDepositPaymentService securityDepositPaymentService,
                                    CalendarEngine calendarEngine,
                                    CalendarDayRepository calendarDayRepository,
                                    YieldAdjustmentRepository yieldAdjustmentRepository,
                                    ServiceRequestService serviceRequestService,
                                    ReservationRepository reservationRepository,
                                    BookingBalanceService bookingBalanceService,
                                    EmailService emailService,
                                    ReviewReplyDraftService reviewReplyDraftService,
                                    ObjectMapper objectMapper,
                                    Clock clock) {
        this.priceEngine = priceEngine;
        this.rateOverrideRepository = rateOverrideRepository;
        this.propertyRepository = propertyRepository;
        this.searchCacheInvalidator = searchCacheInvalidator;
        this.securityDepositRepository = securityDepositRepository;
        this.securityDepositPaymentService = securityDepositPaymentService;
        this.calendarEngine = calendarEngine;
        this.calendarDayRepository = calendarDayRepository;
        this.yieldAdjustmentRepository = yieldAdjustmentRepository;
        this.serviceRequestService = serviceRequestService;
        this.reservationRepository = reservationRepository;
        this.bookingBalanceService = bookingBalanceService;
        this.emailService = emailService;
        this.reviewReplyDraftService = reviewReplyDraftService;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /**
     * Vrai si l'action fait un appel EXTERNE (Stripe) : elle doit alors être
     * exécutée HORS transaction DB (règle audit n°2) — l'orchestration est portée
     * par {@link SupervisionSuggestionService#apply}.
     */
    public boolean hasExternalEffect(String actionType) {
        return SupervisionActionType.DEPOSIT_REFUND.equals(actionType)
                || SupervisionActionType.DEPOSIT_RELEASE.equals(actionType)
                || SupervisionActionType.PAYMENT_REMINDER.equals(actionType)
                || SupervisionActionType.REVIEW_DRAFT_REPLY.equals(actionType);
    }

    /** Dispatche l'exécution selon {@code actionType}. Lève si le type est inconnu ou les params invalides. */
    public void execute(SupervisionSuggestion suggestion) {
        final String type = suggestion.getActionType();
        if (type == null) {
            throw new IllegalStateException("Suggestion non actionnable (actionType absent)");
        }
        switch (type) {
            case SupervisionActionType.PRICE_DROP -> applyPriceDrop(suggestion);
            case SupervisionActionType.DEPOSIT_REFUND, SupervisionActionType.DEPOSIT_RELEASE ->
                    releaseDeposit(suggestion);
            case SupervisionActionType.CALENDAR_BLOCK -> applyCalendarBlock(suggestion);
            case SupervisionActionType.YIELD_PRICE_ADJUST -> applyYieldAdjust(suggestion);
            case SupervisionActionType.CLEANING_REQUEST -> applyCleaningRequest(suggestion);
            case SupervisionActionType.REASSIGN_CLEANING -> applyReassignCleaning(suggestion);
            case SupervisionActionType.PAYMENT_REMINDER -> applyPaymentReminder(suggestion);
            case SupervisionActionType.REVIEW_DRAFT_REPLY -> applyReviewDraftReply(suggestion);
            default -> throw new IllegalStateException("Type d'action non supporté : " + type);
        }
    }

    /**
     * REASSIGN_CLEANING — retente la réassignation d'une demande de ménage dont le
     * prestataire s'est désisté. Idempotent (demande déjà réassignée entre-temps →
     * succès) ; org-scopé strict côté service. Échec de recherche → la carte reste
     * PENDING (l'opérateur peut réessayer plus tard ou assigner manuellement).
     */
    private void applyReassignCleaning(SupervisionSuggestion suggestion) {
        final JsonNode params = parseParams(suggestion.getActionParams());
        if (!params.path("serviceRequestId").isNumber()) {
            throw new IllegalStateException("REASSIGN_CLEANING sans serviceRequestId");
        }
        final long serviceRequestId = params.path("serviceRequestId").asLong();
        final boolean assigned = serviceRequestService.retryAutoAssignForSupervision(
                suggestion.getOrganizationId(), serviceRequestId);
        if (!assigned) {
            throw new IllegalStateException(
                    "Aucun prestataire disponible pour le moment — réessayer plus tard ou assigner manuellement");
        }
        log.info("REASSIGN_CLEANING appliqué org={} property={} serviceRequest={}",
                suggestion.getOrganizationId(), suggestion.getPropertyId(), serviceRequestId);
    }

    /**
     * F2b / F4c — libère le hold Stripe de la caution (remboursement : aucun débit).
     *
     * <p>Recalcul à l'apply : la caution est RE-chargée (org de la suggestion) et doit
     * être encore {@code HELD} — un montant/état stocké dans la suggestion n'est jamais
     * appliqué. L'effet réel passe par {@link SecurityDepositPaymentService#releaseHold}
     * (idempotency key Stripe déterministe {@code deposit-release-<id>}, puis transition
     * CAS {@code HELD → RELEASED} dans sa propre transaction courte).</p>
     */
    private void releaseDeposit(SupervisionSuggestion suggestion) {
        final Long reservationId = resolveReservationId(suggestion);
        final SecurityDeposit deposit = securityDepositRepository
                .findByOrganizationIdAndReservationId(suggestion.getOrganizationId(), reservationId)
                .orElseThrow(() -> new IllegalStateException(
                        "Aucune caution pour la réservation " + reservationId));
        if (deposit.getStatus() != SecurityDepositStatus.HELD) {
            throw new IllegalStateException("Caution " + deposit.getId() + " au statut "
                    + deposit.getStatus() + " — plus rien à libérer");
        }
        securityDepositPaymentService.releaseHold(suggestion.getOrganizationId(), deposit.getId());
        log.info("{} appliqué org={} reservation={} deposit={} ({} {})",
                suggestion.getActionType(), suggestion.getOrganizationId(), reservationId,
                deposit.getId(), deposit.getAmount(), deposit.getCurrency());
    }

    /**
     * F6c — bloque le calendrier du logement sur une plage courte à partir
     * d'aujourd'hui. Écritures DB uniquement (CalendarDay + outbox) : exécuté dans
     * la transaction d'application. {@code CalendarEngine.block} refuse si des jours
     * BOOKED existent dans la plage et re-valide l'ownership org du logement.
     */
    private void applyCalendarBlock(SupervisionSuggestion suggestion) {
        int days = DEFAULT_BLOCK_DAYS;
        if (suggestion.getActionParams() != null && !suggestion.getActionParams().isBlank()) {
            JsonNode params = parseParams(suggestion.getActionParams());
            if (params.path("days").isInt()) {
                days = params.path("days").asInt();
            }
        }
        if (days <= 0 || days > MAX_BLOCK_DAYS) {
            throw new IllegalStateException("Durée de blocage hors bornes : " + days);
        }
        final LocalDate from = LocalDate.now(clock);
        calendarEngine.block(suggestion.getPropertyId(), from, from.plusDays(days),
                suggestion.getOrganizationId(), CALENDAR_BLOCK_SOURCE,
                suggestion.getTitle(), "system:supervisor");
        log.info("CALENDAR_BLOCK appliqué org={} property={} [{}, {}+{}j)",
                suggestion.getOrganizationId(), suggestion.getPropertyId(), from, from, days);
    }

    /**
     * Planifie le menage manquant du depart de demain (agent Operations). Ecriture DB
     * uniquement : exécutée dans la transaction d'application. Réutilise le chemin sûr et
     * idempotent {@link ServiceRequestService#createAutomaticCleaningRequest} (clé unique
     * {@code AUTO_CLEANING}, org re-validée). La carte n'est proposée qu'aux logements en
     * fréquence {@code AFTER_EACH_STAY} (l'apply réussit alors toujours).
     */
    private void applyCleaningRequest(SupervisionSuggestion suggestion) {
        final JsonNode params = parseParams(suggestion.getActionParams());
        final Long reservationId = params.path("reservationId").isNumber()
                ? params.path("reservationId").asLong() : suggestion.getReservationId();
        final LocalDate checkIn = params.path("checkIn").isTextual()
                ? LocalDate.parse(params.path("checkIn").asText()) : null;
        final LocalDate checkOut = params.path("checkOut").isTextual()
                ? LocalDate.parse(params.path("checkOut").asText()) : null;
        if (checkOut == null) {
            throw new IllegalStateException("CLEANING_REQUEST sans date de départ (checkOut)");
        }
        final ServiceRequestService.AutoCleaningOutcome outcome =
                serviceRequestService.createAutomaticCleaningRequest(
                        suggestion.getOrganizationId(), suggestion.getPropertyId(),
                        checkIn, checkOut, reservationId);
        if (outcome.request() == null) {
            final String reason = outcome.skipReason() != null ? outcome.skipReason() : "raison inconnue";
            // Déjà planifié entre-temps (course / re-scan) → idempotent, l'objectif est atteint.
            if (reason.contains("existante")) {
                log.info("CLEANING_REQUEST idempotent org={} property={} reservation={} — {}",
                        suggestion.getOrganizationId(), suggestion.getPropertyId(), reservationId, reason);
                return;
            }
            // Sinon l'action n'a pas pu s'appliquer → échec explicite (la carte reste PENDING).
            throw new IllegalStateException("Ménage non planifiable : " + reason);
        }
        log.info("CLEANING_REQUEST appliqué org={} property={} reservation={} demande={}",
                suggestion.getOrganizationId(), suggestion.getPropertyId(), reservationId,
                outcome.request().getId());
    }

    /**
     * Relance de paiement voyageur (agent Finance) : régénère un lien de paiement pour le solde
     * dû de la réservation ({@link BookingBalanceService#createBalanceCheckoutUrl}) et l'envoie à
     * l'email de paiement. EFFET EXTERNE (Stripe + email) → exécutée HORS transaction par
     * {@link SupervisionSuggestionService#apply} (règle audit n°2), compensation si échec.
     *
     * <p>Règle audit n°1 : l'email, le code et le montant dû sont RE-résolus à l'apply — rien
     * n'est appliqué depuis la suggestion aveuglément. Règle audit n°3 : ownership org re-validé
     * après le {@code findById}. Règle audit n°4 : le nom voyageur est échappé dans le HTML.</p>
     */
    private void applyPaymentReminder(SupervisionSuggestion suggestion) {
        final Long reservationId = resolveReservationId(suggestion);
        final Long orgId = suggestion.getOrganizationId();
        final Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalStateException("Réservation " + reservationId + " introuvable"));
        if (!orgId.equals(reservation.getOrganizationId())) {
            throw new IllegalStateException("Réservation " + reservationId + " hors organisation " + orgId);
        }
        final String email = resolvePaymentEmail(reservation);
        if (email == null) {
            throw new IllegalStateException("Aucun email de paiement pour la réservation " + reservationId);
        }
        final String code = reservation.getConfirmationCode();
        if (code == null || code.isBlank()) {
            throw new IllegalStateException("Réservation " + reservationId + " sans code de confirmation");
        }
        // createBalanceCheckoutUrl lève IllegalStateException en cas d'échec orchestrateur
        // (plus de StripeException checked depuis la migration Vague 2 vers l'orchestration).
        final String checkoutUrl = bookingBalanceService.createBalanceCheckoutUrl(orgId, code);
        final String guest = reservation.getGuestName() != null && !reservation.getGuestName().isBlank()
                ? reservation.getGuestName() : "Bonjour";
        final String body = "<p>" + StringUtils.escapeHtml(guest) + ",</p>"
                + "<p>Le paiement de votre réservation n’a pas pu être finalisé. Vous pouvez le régler "
                + "en toute sécurité via le lien ci-dessous :</p>"
                + "<p><a href=\"" + checkoutUrl + "\">Régler mon paiement</a></p>";
        emailService.sendSimpleHtmlEmail(email, "Votre paiement n’a pas abouti — relance", body);
        log.info("PAYMENT_REMINDER envoyé org={} reservation={} (code {})", orgId, reservationId, code);
    }

    /** Email de relance : priorité à l'email de paiement de la réservation, repli sur le voyageur lié. */
    private String resolvePaymentEmail(Reservation reservation) {
        if (reservation.getPaymentLinkEmail() != null && !reservation.getPaymentLinkEmail().isBlank()) {
            return reservation.getPaymentLinkEmail().trim();
        }
        final Guest g = reservation.getGuest();
        if (g != null && g.getEmail() != null && !g.getEmail().isBlank()) {
            return g.getEmail().trim();
        }
        return null;
    }

    /**
     * REP — génère un BROUILLON de réponse d'avis (LLM) enregistré dans host_response_draft.
     * EFFET EXTERNE (appel LLM) → exécuté hors transaction par {@link SupervisionSuggestionService#apply}.
     * Ne publie rien : l'opérateur valide/édite/publie ensuite. Params : {@code reviewId}.
     */
    private void applyReviewDraftReply(SupervisionSuggestion suggestion) {
        final JsonNode params = parseParams(suggestion.getActionParams());
        if (!params.path("reviewId").isNumber()) {
            throw new IllegalStateException("REVIEW_DRAFT_REPLY sans reviewId");
        }
        reviewReplyDraftService.generateDraft(
                suggestion.getOrganizationId(), params.path("reviewId").asLong());
    }

    private Long resolveReservationId(SupervisionSuggestion suggestion) {
        if (suggestion.getReservationId() != null) {
            return suggestion.getReservationId();
        }
        JsonNode params = parseParams(suggestion.getActionParams());
        if (params.path("reservationId").isNumber()) {
            return params.path("reservationId").asLong();
        }
        throw new IllegalStateException("Réservation absente de la suggestion caution");
    }

    private void applyPriceDrop(SupervisionSuggestion suggestion) {
        final JsonNode params = parseParams(suggestion.getActionParams());
        final Long propertyId = suggestion.getPropertyId();
        final Long orgId = suggestion.getOrganizationId();
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalStateException("Logement introuvable : " + propertyId));
        final String currency = property.getDefaultCurrency() != null ? property.getDefaultCurrency() : "EUR";

        // Sens de l'ajustement : "up" = hausse (facteur 1+p/100), sinon baisse (1−p/100). Défaut baisse.
        final boolean raise = "up".equalsIgnoreCase(params.path("direction").asText("down"));

        // Chemin AUTO (Vague 1, appliedBy = auto:gate) : protections du cadre yield
        // ré-appliquées AU MOMENT de l'apply (règle audit n°1 — jamais de confiance
        // aveugle aux conditions du scan) : bornes plancher/plafond OBLIGATOIRES,
        // overrides MANUAL/OTA jamais écrasés, nuits BOOKED jamais re-tarifées.
        // Le chemin humain (bouton/modale) reste inchangé : l'opérateur décide.
        final boolean auto = SupervisionSuggestion.APPLIED_BY_AUTO.equals(suggestion.getAppliedBy());
        final BigDecimal floor = property.getYieldPriceFloor();
        final BigDecimal ceiling = property.getYieldPriceCeiling();
        if (auto && (floor == null || ceiling == null)) {
            throw new IllegalStateException(
                    "Plancher/plafond yield absents sur le logement " + propertyId
                            + " — auto-application refusée (la carte reste à valider)");
        }

        // Yield multi-segment : {"direction":…,"segments":[{from,to,percent}, …]} ; rétro-compat {from,to,percent}.
        final List<JsonNode> segments = new ArrayList<>();
        if (params.has("segments") && params.get("segments").isArray()) {
            params.get("segments").forEach(segments::add);
        } else {
            segments.add(params);
        }
        if (segments.isEmpty()) {
            throw new IllegalStateException("Aucun segment de prix à appliquer");
        }

        int applied = 0;
        for (JsonNode seg : segments) {
            final LocalDate from = LocalDate.parse(seg.path("from").asText());
            final LocalDate to = LocalDate.parse(seg.path("to").asText()); // exclusif
            final int percent = seg.path("percent").asInt();
            if (!from.isBefore(to)) {
                throw new IllegalStateException("Plage invalide : from >= to");
            }
            if (percent <= 0 || percent > MAX_PERCENT) {
                throw new IllegalStateException("Pourcentage d'ajustement hors bornes : " + percent);
            }
            final java.util.Set<LocalDate> bookedNights = auto
                    ? new java.util.HashSet<>(calendarDayRepository.findBookedDatesInRange(
                            propertyId, from, to, orgId))
                    : java.util.Set.of();
            applied += applyAdjustOnRange(property, orgId, propertyId, from, to, percent, raise,
                    currency, auto, bookedNights, floor, ceiling);
        }
        searchCacheInvalidator.onAvailabilityOrPriceChanged();
        log.info("PRICE_{} appliqué org={} property={} : {} segment(s), {} nuit(s){}",
                raise ? "RAISE" : "DROP", orgId, propertyId, segments.size(), applied,
                auto ? " [auto]" : "");
    }

    /**
     * Applique un ajustement de {@code percent}% (hausse si {@code raise}, sinon baisse) sur
     * chaque nuit de [from, to). En mode {@code auto}, les nuits BOOKED et les overrides
     * d'une autre source (MANUAL / OTA / externe) sont sautés, et le prix cible est borné
     * par le plancher/plafond yield du bien.
     */
    private int applyAdjustOnRange(Property property, Long orgId, Long propertyId,
                                   LocalDate from, LocalDate to, int percent, boolean raise,
                                   String currency, boolean auto,
                                   java.util.Set<LocalDate> bookedNights,
                                   BigDecimal floor, BigDecimal ceiling) {
        final BigDecimal delta = BigDecimal.valueOf(percent).divide(BigDecimal.valueOf(100));
        final BigDecimal factor = raise ? BigDecimal.ONE.add(delta) : BigDecimal.ONE.subtract(delta);
        int applied = 0;
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            if (auto && bookedNights.contains(date)) {
                continue; // nuit réservée : jamais re-tarifée automatiquement
            }
            final LocalDate d = date;
            final var existing = rateOverrideRepository.findByPropertyIdAndDate(propertyId, d, orgId);
            if (auto && existing.isPresent()
                    && !OVERRIDE_SOURCE.equals(existing.get().getSource())
                    && !YIELD_OVERRIDE_SOURCE.equals(existing.get().getSource())) {
                continue; // override MANUAL / OTA / externe : jamais écrasé automatiquement
            }
            final BigDecimal current = priceEngine.resolvePrice(propertyId, date, orgId);
            if (current == null || current.signum() <= 0) {
                continue; // pas de prix résolu → rien à baisser ce jour
            }
            BigDecimal newPrice = current.multiply(factor).setScale(2, RoundingMode.HALF_UP);
            if (auto) {
                newPrice = newPrice.max(floor).min(ceiling);
                if (newPrice.compareTo(current) == 0) {
                    continue; // déjà à la borne (ou variation nulle)
                }
            }
            final BigDecimal target = newPrice;
            final RateOverride override = existing
                    .orElseGet(() -> new RateOverride(property, d, target, OVERRIDE_SOURCE, orgId));
            override.setNightlyPrice(target);
            override.setSource(OVERRIDE_SOURCE);
            override.setCurrency(currency);
            override.setCreatedBy(auto ? "auto:gate" : "system:supervisor");
            rateOverrideRepository.save(override);
            applied++;
        }
        return applied;
    }

    /**
     * F8a (yield v1, mode SUGGEST) — applique l'ajustement yield approuvé par
     * l'opérateur. Écritures DB uniquement (RateOverride + journal) : exécuté
     * dans la transaction d'application.
     *
     * <p>Garanties (règle audit n°1 + garde-fous F8a) :</p>
     * <ul>
     *   <li>prix RE-résolus à l'apply — le montant de la suggestion n'est
     *       jamais appliqué aveuglément ;</li>
     *   <li>plancher/plafond yield du bien OBLIGATOIRES (sinon échec explicite) ;</li>
     *   <li>cap « un apply par bien et par jour calendaire » (timezone du bien)
     *       via le journal — l'index unique partiel DB couvre la course ;</li>
     *   <li>les overrides d'une autre source (MANUAL, OTA…) ne sont jamais écrasés ;</li>
     *   <li>chaque nuit ajustée est journalisée APPLIED avec le lien suggestion.</li>
     * </ul>
     */
    private void applyYieldAdjust(SupervisionSuggestion suggestion) {
        final JsonNode params = parseParams(suggestion.getActionParams());
        final LocalDate from = LocalDate.parse(params.path("from").asText());
        final LocalDate to = LocalDate.parse(params.path("to").asText()); // exclusif
        final BigDecimal percent = new BigDecimal(params.path("percent").asText("0"));
        if (!from.isBefore(to) || from.plusDays(MAX_YIELD_WINDOW_DAYS).isBefore(to)) {
            throw new IllegalStateException("Plage yield invalide : " + from + " → " + to);
        }
        if (percent.signum() == 0 || percent.abs().compareTo(MAX_YIELD_PERCENT) > 0) {
            throw new IllegalStateException("Pourcentage yield hors bornes : " + percent);
        }

        final Long propertyId = suggestion.getPropertyId();
        final Long orgId = suggestion.getOrganizationId();
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalStateException("Logement introuvable : " + propertyId));
        final BigDecimal floor = property.getYieldPriceFloor();
        final BigDecimal ceiling = property.getYieldPriceCeiling();
        if (floor == null || ceiling == null) {
            throw new IllegalStateException(
                    "Plancher/plafond yield absents sur le logement " + propertyId
                            + " — configurez les bornes avant d'appliquer");
        }

        final LocalDate today = LocalDate.ofInstant(clock.instant(), propertyZone(property));
        if (yieldAdjustmentRepository.existsByPropertyIdAndAdjustmentDayAndModeAndSkipReasonIsNull(
                propertyId, today, YieldAdjustment.Mode.APPLIED)) {
            throw new IllegalStateException(
                    "Un ajustement yield a déjà été appliqué aujourd'hui sur ce logement (cap journalier)");
        }

        final String currency = property.getDefaultCurrency() != null ? property.getDefaultCurrency() : "EUR";
        final BigDecimal factor = BigDecimal.ONE.add(
                percent.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
        final Long ruleId = params.path("ruleId").isNumber() ? params.path("ruleId").asLong() : null;

        int applied = 0;
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            final LocalDate d = date;
            final var existing = rateOverrideRepository.findByPropertyIdAndDate(propertyId, d, orgId);
            if (existing.isPresent() && !YIELD_OVERRIDE_SOURCE.equals(existing.get().getSource())) {
                continue; // jamais d'écrasement d'un override MANUAL / OTA / externe
            }
            final BigDecimal current = priceEngine.resolvePrice(propertyId, d, orgId);
            if (current == null || current.signum() <= 0) {
                continue;
            }
            final BigDecimal target = current.multiply(factor).setScale(2, RoundingMode.HALF_UP)
                    .max(floor).min(ceiling);
            if (target.compareTo(current) == 0) {
                continue;
            }
            final RateOverride override = existing
                    .orElseGet(() -> new RateOverride(property, d, target, YIELD_OVERRIDE_SOURCE, orgId));
            override.setNightlyPrice(target);
            override.setSource(YIELD_OVERRIDE_SOURCE);
            override.setCurrency(currency);
            override.setCreatedBy("system:yield");
            rateOverrideRepository.save(override);

            final YieldAdjustment journal = new YieldAdjustment(
                    orgId, propertyId, today, YieldAdjustment.Mode.APPLIED);
            journal.setRuleId(ruleId);
            journal.setTargetDate(d);
            journal.setPriceBefore(current);
            journal.setPriceAfter(target);
            journal.setSuggestionId(suggestion.getId());
            journal.setReason(suggestion.getTitle());
            yieldAdjustmentRepository.save(journal);
            applied++;
        }
        searchCacheInvalidator.onAvailabilityOrPriceChanged();
        log.info("YIELD_PRICE_ADJUST appliqué org={} property={} {}→{} {}% ({} nuit(s))",
                orgId, propertyId, from, to, percent, applied);
    }

    private static ZoneId propertyZone(Property property) {
        final String timezone = property.getTimezone();
        if (timezone == null || timezone.isBlank()) {
            return DEFAULT_PROPERTY_ZONE;
        }
        try {
            return ZoneId.of(timezone);
        } catch (DateTimeException e) {
            return DEFAULT_PROPERTY_ZONE;
        }
    }

    private JsonNode parseParams(String json) {
        if (json == null || json.isBlank()) {
            throw new IllegalStateException("Params d'action absents");
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException("Params d'action illisibles : " + e.getMessage(), e);
        }
    }
}
