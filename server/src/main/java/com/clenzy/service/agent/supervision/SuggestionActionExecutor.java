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
import com.clenzy.integration.channex.service.ChannexSyncService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
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
    // ObjectProvider : ICalImportService dépend de SupervisionSuggestionService, qui
    // dépend de cet exécuteur — l'injection paresseuse casse le cycle Spring. Même
    // traitement pour ChannexSyncService (symétrie + résilience au conditionnel).
    private final ObjectProvider<com.clenzy.service.ICalImportService> icalImportService;
    private final ObjectProvider<ChannexSyncService> channexSyncService;
    private final com.clenzy.repository.NoiseAlertRepository noiseAlertRepository;
    private final ObjectProvider<com.clenzy.service.NoiseAlertNotificationService> noiseAlertNotificationService;
    private final ObjectProvider<com.clenzy.scheduler.AbandonedBookingRecoveryScheduler> cartRecoveryScheduler;
    private final ObjectProvider<com.clenzy.service.WelcomeGuideService> welcomeGuideService;
    private final ObjectProvider<com.clenzy.service.payout.HousekeeperPayoutService> housekeeperPayoutService;
    private final ObjectProvider<com.clenzy.service.ReservationService> reservationService;
    private final ObjectProvider<com.clenzy.integration.compliance.submission.ComplianceSubmissionService> complianceSubmissionService;
    private final com.clenzy.repository.ManagementContractRepository managementContractRepository;
    private final ObjectProvider<com.clenzy.service.signature.ContractSignatureService> contractSignatureService;
    private final ObjectProvider<com.clenzy.repository.UserRepository> userRepositoryProvider;
    private final ObjectProvider<com.clenzy.repository.OrganizationRepository> organizationRepositoryProvider;
    private final ObjectProvider<com.clenzy.service.OwnerStatementService> ownerStatementService;
    private final com.clenzy.repository.MinNightsOverrideRepository minNightsOverrideRepository;
    private final com.clenzy.repository.RatePlanRepository ratePlanRepository;
    private final com.clenzy.repository.UpsellOfferRepository upsellOfferRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    /** Fenêtre de republication de parité par défaut / max (jours). */
    static final int PARITY_DEFAULT_DAYS = 30;
    static final int PARITY_MAX_DAYS = 90;

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
                                    ObjectProvider<com.clenzy.service.ICalImportService> icalImportService,
                                    ObjectProvider<ChannexSyncService> channexSyncService,
                                    com.clenzy.repository.NoiseAlertRepository noiseAlertRepository,
                                    ObjectProvider<com.clenzy.service.NoiseAlertNotificationService> noiseAlertNotificationService,
                                    ObjectProvider<com.clenzy.scheduler.AbandonedBookingRecoveryScheduler> cartRecoveryScheduler,
                                    ObjectProvider<com.clenzy.service.WelcomeGuideService> welcomeGuideService,
                                    ObjectProvider<com.clenzy.service.payout.HousekeeperPayoutService> housekeeperPayoutService,
                                    ObjectProvider<com.clenzy.service.ReservationService> reservationService,
                                    ObjectProvider<com.clenzy.integration.compliance.submission.ComplianceSubmissionService> complianceSubmissionService,
                                    com.clenzy.repository.ManagementContractRepository managementContractRepository,
                                    ObjectProvider<com.clenzy.service.signature.ContractSignatureService> contractSignatureService,
                                    ObjectProvider<com.clenzy.repository.UserRepository> userRepositoryProvider,
                                    ObjectProvider<com.clenzy.repository.OrganizationRepository> organizationRepositoryProvider,
                                    ObjectProvider<com.clenzy.service.OwnerStatementService> ownerStatementService,
                                    com.clenzy.repository.MinNightsOverrideRepository minNightsOverrideRepository,
                                    com.clenzy.repository.RatePlanRepository ratePlanRepository,
                                    com.clenzy.repository.UpsellOfferRepository upsellOfferRepository,
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
        this.icalImportService = icalImportService;
        this.channexSyncService = channexSyncService;
        this.noiseAlertRepository = noiseAlertRepository;
        this.noiseAlertNotificationService = noiseAlertNotificationService;
        this.cartRecoveryScheduler = cartRecoveryScheduler;
        this.welcomeGuideService = welcomeGuideService;
        this.housekeeperPayoutService = housekeeperPayoutService;
        this.reservationService = reservationService;
        this.complianceSubmissionService = complianceSubmissionService;
        this.managementContractRepository = managementContractRepository;
        this.contractSignatureService = contractSignatureService;
        this.userRepositoryProvider = userRepositoryProvider;
        this.organizationRepositoryProvider = organizationRepositoryProvider;
        this.ownerStatementService = ownerStatementService;
        this.minNightsOverrideRepository = minNightsOverrideRepository;
        this.ratePlanRepository = ratePlanRepository;
        this.upsellOfferRepository = upsellOfferRepository;
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
                || SupervisionActionType.REVIEW_DRAFT_REPLY.equals(actionType)
                || SupervisionActionType.ICAL_RETRY.equals(actionType)
                || SupervisionActionType.PARITY_REPUBLISH.equals(actionType)
                || SupervisionActionType.NOISE_WARNING_SEND.equals(actionType)
                || SupervisionActionType.CART_RECOVERY_SEND.equals(actionType)
                || SupervisionActionType.GUIDE_SEND.equals(actionType)
                || SupervisionActionType.REVIEW_REQUEST_SEND.equals(actionType)
                || SupervisionActionType.CLEANING_PAYOUT.equals(actionType)
                || SupervisionActionType.POLICE_DECLARE.equals(actionType)
                || SupervisionActionType.MANDATE_SIGN_SEND.equals(actionType)
                || SupervisionActionType.OWNER_STATEMENT_SEND.equals(actionType)
                || SupervisionActionType.UPSELL_OFFER.equals(actionType);
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
            case SupervisionActionType.ICAL_RETRY -> applyIcalRetry(suggestion);
            case SupervisionActionType.PARITY_REPUBLISH -> applyParityRepublish(suggestion);
            case SupervisionActionType.NOISE_WARNING_SEND -> applyNoiseWarningSend(suggestion);
            case SupervisionActionType.CART_RECOVERY_SEND -> applyCartRecoverySend(suggestion);
            case SupervisionActionType.GUIDE_SEND -> applyGuideSend(suggestion);
            case SupervisionActionType.REVIEW_REQUEST_SEND -> applyReviewRequestSend(suggestion);
            case SupervisionActionType.CLEANING_PAYOUT -> applyCleaningPayout(suggestion);
            case SupervisionActionType.FRAUD_BLOCK -> applyFraudBlock(suggestion);
            case SupervisionActionType.POLICE_DECLARE -> applyPoliceDeclare(suggestion);
            case SupervisionActionType.MANDATE_SIGN_SEND -> applyMandateSignSend(suggestion);
            case SupervisionActionType.OWNER_STATEMENT_SEND -> applyOwnerStatementSend(suggestion);
            case SupervisionActionType.MIN_STAY_RESTRICTION -> applyMinStayRestriction(suggestion);
            case SupervisionActionType.PROMO_DEACTIVATE -> applyPromoDeactivate(suggestion);
            case SupervisionActionType.UPSELL_OFFER -> applyUpsellOffer(suggestion);
            default -> throw new IllegalStateException("Type d'action non supporté : " + type);
        }
    }

    /**
     * UPSELL_OFFER — adresse l'offre au voyageur par email avec le lien du livret :
     * l'ACHAT reste le flux Stripe du livret (jamais de débit direct ici — règle
     * argent n°1 : aucun montant de carte n'est débité aveuglément). L'offre est
     * re-validée à l'apply (org, active, applicable au logement).
     */
    private void applyUpsellOffer(SupervisionSuggestion suggestion) {
        final Reservation reservation = loadOrgReservation(suggestion);
        final long offerId = requiredLongParam(suggestion, "offerId");
        final com.clenzy.model.UpsellOffer offer = upsellOfferRepository
                .findByIdAndOrganizationId(offerId, suggestion.getOrganizationId())
                .orElseThrow(() -> new IllegalStateException("Offre introuvable pour cette organisation"));
        if (!offer.isActive() || (offer.getPropertyId() != null
                && !offer.getPropertyId().equals(suggestion.getPropertyId()))) {
            throw new IllegalStateException("Offre inactive ou inapplicable à ce logement");
        }
        final String email = PostStayReviewScanner.resolveGuestEmail(reservation);
        if (email == null) {
            throw new IllegalStateException("Aucun email voyageur pour la réservation "
                    + reservation.getId());
        }
        final String link = welcomeGuideService.getObject().linkForReservation(reservation)
                .orElseThrow(() -> new IllegalStateException(
                        "Aucun livret publié — l'offre n'a pas de canal d'achat"));
        final String guest = reservation.getGuestName() != null && !reservation.getGuestName().isBlank()
                ? StringUtils.escapeHtml(reservation.getGuestName().strip()) : "Bonjour";
        final String body = "<p>" + guest + ",</p>"
                + "<p>Pour rendre votre séjour encore plus confortable, nous vous proposons : "
                + "<b>" + StringUtils.escapeHtml(offer.getTitle()) + "</b> ("
                + offer.getPrice() + " " + StringUtils.escapeHtml(offer.getCurrency()) + ").</p>"
                + "<p>Vous pouvez la réserver en un clic depuis votre livret d'accueil :</p>"
                + "<p><a href=\"" + link + "\">Voir l'offre dans mon livret</a></p>";
        emailService.sendSimpleHtmlEmail(email,
                "Une option pour votre séjour : " + offer.getTitle(), body);
        log.info("UPSELL_OFFER envoyé org={} reservation={} offre={}",
                suggestion.getOrganizationId(), reservation.getId(), offerId);
    }

    /** Source des overrides min-stay posés par la supervision (réversibles, jamais mélangés). */
    static final String MIN_STAY_SOURCE = "SUPERVISION_MIN_STAY";
    static final int MIN_STAY_MAX_WINDOW_DAYS = 92;

    /**
     * MIN_STAY_RESTRICTION — pose des overrides de séjour minimum sur la fenêtre
     * (week-ends seulement par défaut). Un override existant d'une AUTRE source n'est
     * jamais écrasé (MANUAL prime, ORPHAN_GAP est plus spécifique) ; les nôtres sont
     * mis à jour. Écriture DB pure (dans la transaction d'apply).
     */
    private void applyMinStayRestriction(SupervisionSuggestion suggestion) {
        final LocalDate from;
        final LocalDate to;
        final int minNights;
        final boolean weekendsOnly;
        try {
            final JsonNode params = objectMapper.readTree(suggestion.getActionParams());
            from = LocalDate.parse(params.get("from").asText());
            to = LocalDate.parse(params.get("to").asText());
            minNights = Math.max(2, Math.min(7, params.path("minNights").asInt(2)));
            weekendsOnly = params.path("weekendsOnly").asBoolean(true);
        } catch (Exception e) {
            throw new IllegalStateException("Paramètres de restriction illisibles", e);
        }
        if (!to.isAfter(from) || from.plusDays(MIN_STAY_MAX_WINDOW_DAYS).isBefore(to)) {
            throw new IllegalStateException("Fenêtre de restriction invalide (1.."
                    + MIN_STAY_MAX_WINDOW_DAYS + " jours)");
        }
        final Property property = propertyRepository.findById(suggestion.getPropertyId())
                .orElseThrow(() -> new IllegalStateException("Logement introuvable"));
        if (!suggestion.getOrganizationId().equals(property.getOrganizationId())) {
            throw new IllegalStateException("Logement hors organisation");
        }
        final Long orgId = suggestion.getOrganizationId();
        int written = 0;
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            if (weekendsOnly && date.getDayOfWeek() != java.time.DayOfWeek.FRIDAY
                    && date.getDayOfWeek() != java.time.DayOfWeek.SATURDAY) {
                continue;
            }
            final var existing = minNightsOverrideRepository
                    .findByPropertyIdAndDate(property.getId(), date, orgId).orElse(null);
            if (existing != null && !MIN_STAY_SOURCE.equals(existing.getSource())) {
                continue; // une autre source (MANUAL, ORPHAN_GAP…) a priorité — jamais écrasée
            }
            final com.clenzy.model.MinNightsOverride override = existing != null
                    ? existing
                    : new com.clenzy.model.MinNightsOverride(
                            property, date, minNights, MIN_STAY_SOURCE, orgId);
            override.setMinNights(minNights);
            minNightsOverrideRepository.save(override);
            written++;
        }
        if (written == 0) {
            throw new IllegalStateException(
                    "Aucune nuit restreignable (overrides existants d'autres sources ?)");
        }
        log.info("MIN_STAY_RESTRICTION appliqué org={} property={} nuits={} min={}",
                orgId, property.getId(), written, minNights);
    }

    /**
     * PROMO_DEACTIVATE — désactive le rate plan cannibale ({@code isActive = false}).
     * Org re-validée sur le plan ; réversible depuis l'écran Tarification.
     */
    private void applyPromoDeactivate(SupervisionSuggestion suggestion) {
        final long ratePlanId = requiredLongParam(suggestion, "ratePlanId");
        final com.clenzy.model.RatePlan plan = ratePlanRepository.findById(ratePlanId)
                .orElseThrow(() -> new IllegalStateException("Rate plan introuvable"));
        if (plan.getOrganizationId() == null
                || !plan.getOrganizationId().equals(suggestion.getOrganizationId())) {
            throw new IllegalStateException("Rate plan introuvable pour cette organisation");
        }
        plan.setIsActive(false);
        ratePlanRepository.save(plan);
        log.info("PROMO_DEACTIVATE appliqué org={} plan={} ({})",
                suggestion.getOrganizationId(), ratePlanId, plan.getName());
    }

    /**
     * POLICE_DECLARE — soumet toutes les fiches COMPLÉTÉES du séjour à l'autorité via
     * la stratégie par provider. Org re-validée sur la réservation. EFFET EXTERNE.
     */
    private void applyPoliceDeclare(SupervisionSuggestion suggestion) {
        final Reservation reservation = loadOrgReservation(suggestion);
        complianceSubmissionService.getObject()
                .submitForReservation(reservation.getId(), suggestion.getOrganizationId());
    }

    /**
     * MANDATE_SIGN_SEND — envoie le mandat en signature électronique au propriétaire.
     * Org re-validée par {@code findByIdAndOrgId}. Email propriétaire requis (échec
     * explicite sinon — {@code requestSignature} refuse silencieusement, on veut le dire).
     */
    private void applyMandateSignSend(SupervisionSuggestion suggestion) {
        final long contractId = requiredLongParam(suggestion, "contractId");
        final com.clenzy.model.ManagementContract contract = managementContractRepository
                .findByIdAndOrgId(contractId, suggestion.getOrganizationId())
                .orElseThrow(() -> new IllegalStateException(
                        "Mandat introuvable pour cette organisation"));
        final String ownerEmail = contract.getOwnerId() != null
                ? userRepositoryProvider.getObject().findById(contract.getOwnerId())
                        .map(com.clenzy.model.User::getEmail).orElse(null)
                : null;
        if (ownerEmail == null || ownerEmail.isBlank()) {
            throw new IllegalStateException("Propriétaire sans email — signature impossible");
        }
        contractSignatureService.getObject().requestSignature(contract, ownerEmail)
                .orElseThrow(() -> new IllegalStateException(
                        "Demande de signature non émise (document indisponible ?)"));
    }

    /**
     * OWNER_STATEMENT_SEND — envoie le relevé mensuel : montants RE-calculés depuis les
     * reversements PAID par {@code sendStatement} (règle audit n°1). L'ownership du
     * propriétaire est garanti par la requête interne org-scopée du service.
     */
    private void applyOwnerStatementSend(SupervisionSuggestion suggestion) {
        final long ownerId = requiredLongParam(suggestion, "ownerId");
        final LocalDate from;
        final LocalDate to;
        try {
            final JsonNode params = objectMapper.readTree(suggestion.getActionParams());
            from = LocalDate.parse(params.get("from").asText());
            to = LocalDate.parse(params.get("to").asText());
        } catch (Exception e) {
            throw new IllegalStateException("Période du relevé illisible", e);
        }
        final String conciergerieName = organizationRepositoryProvider.getObject()
                .findById(suggestion.getOrganizationId())
                .map(com.clenzy.model.Organization::getName).orElse("Votre conciergerie");
        ownerStatementService.getObject().sendStatement(
                ownerId, suggestion.getOrganizationId(), from, to, conciergerieName);
    }

    /**
     * CLEANING_PAYOUT — délègue à {@code HousekeeperPayoutService.retryPayout} : org
     * validée là-bas, re-gate complet (preuve, onboarding, montants re-résolus — règle
     * audit n°1), verrou anti-double-versement. Un re-gate non satisfait lève une
     * IllegalStateException explicite → la carte reste PENDING. EFFET EXTERNE (Stripe).
     */
    private void applyCleaningPayout(SupervisionSuggestion suggestion) {
        final long recordId = requiredLongParam(suggestion, "recordId");
        housekeeperPayoutService.getObject().retryPayout(recordId, suggestion.getOrganizationId());
    }

    /**
     * FRAUD_BLOCK — annule la réservation signalée à risque TANT qu'elle est
     * {@code pending} : une réservation payée/confirmée exige le flux de remboursement
     * de la fiche réservation, jamais un blocage aveugle (règle argent n°1).
     * {@code ReservationService.cancel} libère le calendrier, révoque les codes d'accès
     * et expire la session Stripe ouverte (org re-validée par le tenant courant).
     */
    private void applyFraudBlock(SupervisionSuggestion suggestion) {
        final Reservation reservation = loadOrgReservation(suggestion);
        if (!"pending".equalsIgnoreCase(reservation.getStatus())) {
            throw new IllegalStateException("Réservation déjà " + reservation.getStatus()
                    + " — blocage direct refusé, passer par la fiche réservation (remboursement)");
        }
        reservationService.getObject().cancel(reservation.getId());
    }

    /**
     * GUIDE_SEND — envoie le lien du livret d'accueil au voyageur qui arrive demain
     * (agent Voyageur). Le lien (token borné au séjour) est généré MAINTENANT via
     * {@code WelcomeGuideService.linkForReservation} — jamais stocké dans la carte.
     * EFFET EXTERNE (email) → l'orchestration nous invoque hors transaction.
     */
    private void applyGuideSend(SupervisionSuggestion suggestion) {
        final Reservation reservation = loadOrgReservation(suggestion);
        final String email = PostStayReviewScanner.resolveGuestEmail(reservation);
        if (email == null) {
            throw new IllegalStateException("Aucun email voyageur pour la réservation "
                    + reservation.getId());
        }
        final String link = welcomeGuideService.getObject().linkForReservation(reservation)
                .orElseThrow(() -> new IllegalStateException(
                        "Aucun livret d'accueil publié pour ce logement"));
        final String guest = reservation.getGuestName() != null && !reservation.getGuestName().isBlank()
                ? StringUtils.escapeHtml(reservation.getGuestName().strip()) : "Bonjour";
        final String body = "<p>" + guest + ",</p>"
                + "<p>Votre arrivée approche ! Retrouvez toutes les informations de votre séjour "
                + "(accès, wifi, équipements, recommandations) dans votre livret d'accueil :</p>"
                + "<p><a href=\"" + link + "\">Ouvrir mon livret d'accueil</a></p>"
                + "<p>Ce lien est personnel et valable pour la durée de votre séjour.</p>";
        emailService.sendSimpleHtmlEmail(email, "Votre livret d'accueil — arrivée demain", body);
        log.info("GUIDE_SEND envoyé org={} reservation={}", suggestion.getOrganizationId(),
                reservation.getId());
    }

    /**
     * REVIEW_REQUEST_SEND — demande d'avis post-séjour (agent Voyageur). Le lien
     * d'avis (token à durée bornée) est généré à l'apply via
     * {@code WelcomeGuideService.reviewLinkForReservation}. EFFET EXTERNE (email).
     */
    private void applyReviewRequestSend(SupervisionSuggestion suggestion) {
        final Reservation reservation = loadOrgReservation(suggestion);
        final String email = PostStayReviewScanner.resolveGuestEmail(reservation);
        if (email == null) {
            throw new IllegalStateException("Aucun email voyageur pour la réservation "
                    + reservation.getId());
        }
        final String link = welcomeGuideService.getObject().reviewLinkForReservation(reservation)
                .orElseThrow(() -> new IllegalStateException(
                        "Aucun livret d'accueil publié — lien d'avis indisponible"));
        final String guest = reservation.getGuestName() != null && !reservation.getGuestName().isBlank()
                ? StringUtils.escapeHtml(reservation.getGuestName().strip()) : "Bonjour";
        final String body = "<p>" + guest + ",</p>"
                + "<p>Merci pour votre séjour ! Un petit mot de votre part aide énormément : "
                + "pourriez-vous partager votre expérience ?</p>"
                + "<p><a href=\"" + link + "\">Laisser mon avis</a></p>";
        emailService.sendSimpleHtmlEmail(email, "Comment s'est passé votre séjour ?", body);
        log.info("REVIEW_REQUEST_SEND envoyé org={} reservation={}", suggestion.getOrganizationId(),
                reservation.getId());
    }

    /** Charge la réservation de la suggestion en re-validant l'org (règle audit n°3). */
    private Reservation loadOrgReservation(SupervisionSuggestion suggestion) {
        final Long reservationId = resolveReservationId(suggestion);
        final Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalStateException(
                        "Réservation " + reservationId + " introuvable"));
        if (!suggestion.getOrganizationId().equals(reservation.getOrganizationId())) {
            throw new IllegalStateException("Réservation " + reservationId
                    + " hors organisation " + suggestion.getOrganizationId());
        }
        return reservation;
    }

    /**
     * NOISE_WARNING_SEND — avertit le voyageur du séjour en cours (WhatsApp, repli
     * email). L'org de la suggestion est re-validée contre l'alerte ({@code findById}
     * contourne le filtre Hibernate — règle audit n°3). Un envoi ignoré par le service
     * (pas de séjour en cours, avertissement déjà parti sous 24 h…) échoue EXPLICITEMENT :
     * l'opérateur voit pourquoi rien n'est parti, la carte reste PENDING.
     */
    private void applyNoiseWarningSend(SupervisionSuggestion suggestion) {
        final long alertId = requiredLongParam(suggestion, "alertId");
        final com.clenzy.model.NoiseAlert alert = noiseAlertRepository.findById(alertId)
                .orElseThrow(() -> new IllegalStateException("Alerte bruit introuvable"));
        if (alert.getOrganizationId() == null
                || !alert.getOrganizationId().equals(suggestion.getOrganizationId())) {
            throw new IllegalStateException("Alerte bruit introuvable pour cette organisation");
        }
        final var outcome = noiseAlertNotificationService.getObject().sendGuestWarning(alert);
        if (!outcome.sent()) {
            throw new IllegalStateException("Avertissement non envoyé : " + outcome.skipReason());
        }
    }

    /**
     * CART_RECOVERY_SEND — envoie la relance du panier abandonné (orgs sans relance
     * automatique). Toutes les gardes (org, statut PENDING, étape bornée, consentement
     * RGPD) sont re-vérifiées par {@code sendRecoveryForSupervision} au moment de l'envoi.
     */
    private void applyCartRecoverySend(SupervisionSuggestion suggestion) {
        final long abandonedBookingId = requiredLongParam(suggestion, "abandonedBookingId");
        cartRecoveryScheduler.getObject()
                .sendRecoveryForSupervision(abandonedBookingId, suggestion.getOrganizationId());
    }

    /**
     * ICAL_RETRY — relance la synchronisation du flux iCal en échec. L'org de la
     * suggestion est re-validée contre le feed par
     * {@code ICalImportService.retryFeedForSupervision} ; le fetch HTTP du calendrier
     * distant est un EFFET EXTERNE (exécuté hors transaction). Idempotent : un flux
     * redevenu sain se re-synchronise sans effet de bord.
     */
    private void applyIcalRetry(SupervisionSuggestion suggestion) {
        final long feedId = requiredLongParam(suggestion, "feedId");
        icalImportService.getObject().retryFeedForSupervision(feedId, suggestion.getOrganizationId());
    }

    /**
     * PARITY_REPUBLISH — re-pousse l'ARI de la fenêtre de contrôle vers Channex.
     * Les prix poussés sont RE-résolus par le PriceEngine au moment du push (règle
     * audit n°1) ; l'appel HTTP Channex est un EFFET EXTERNE (hors transaction).
     */
    private void applyParityRepublish(SupervisionSuggestion suggestion) {
        final int days = boundedIntParam(suggestion, "days", PARITY_DEFAULT_DAYS, 1, PARITY_MAX_DAYS);
        final LocalDate today = LocalDate.now(clock);
        final ChannexSyncService.ChannexSyncResult result = channexSyncService.getObject().pushProperty(
                suggestion.getPropertyId(), suggestion.getOrganizationId(), today, today.plusDays(days));
        if (result == null || !result.success()) {
            throw new IllegalStateException("Republication Channex échouée : "
                    + (result != null ? result.message() : "aucun résultat"));
        }
    }

    private long requiredLongParam(SupervisionSuggestion suggestion, String field) {
        try {
            final JsonNode node = objectMapper.readTree(suggestion.getActionParams()).get(field);
            if (node == null || !node.canConvertToLong()) {
                throw new IllegalStateException("Paramètre « " + field + " » manquant");
            }
            return node.asLong();
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Paramètres d'action illisibles", e);
        }
    }

    private int boundedIntParam(SupervisionSuggestion suggestion, String field,
                                int defaultValue, int min, int max) {
        try {
            final String raw = suggestion.getActionParams();
            final JsonNode node = raw == null ? null : objectMapper.readTree(raw).get(field);
            final int value = node != null && node.canConvertToInt() ? node.asInt() : defaultValue;
            return Math.max(min, Math.min(max, value));
        } catch (Exception e) {
            return defaultValue;
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
