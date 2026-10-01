package com.clenzy.service;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.SecurityDepositRepository;
import com.stripe.exception.CardException;
import com.stripe.exception.InvalidRequestException;
import com.stripe.exception.StripeException;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Effet Stripe de la pré-autorisation de caution : pose off-session sur la carte enregistrée à la
 * réservation, renouvellement avant échéance, constat d'échéance. Contexte SYSTÈME (scheduler,
 * webhook) : l'appelant a déjà résolu l'organisation de la caution et de sa réservation.
 *
 * <p>L'échéance du hold est celle que Stripe annonce ({@code capture_before}), jamais une durée
 * supposée — les fenêtres varient par réseau et par type de transaction (MIT/CIT). Quand poser et
 * quand renouveler : {@link SecurityDepositHoldPolicy}.</p>
 *
 * <p>Audit #2 : aucun appel Stripe dans une transaction — les transitions sont des UPDATE
 * conditionnels (audit #8) portés par le repository, chacun dans sa transaction courte. Audit #7 :
 * un refus produit un statut ou un motif explicite ({@code holdError}) ET une notification ;
 * une indisponibilité Stripe ne change rien et sera retentée au passage suivant.</p>
 */
@Service
public class SecurityDepositHoldService {

    private static final Logger log = LoggerFactory.getLogger(SecurityDepositHoldService.class);

    static final String PI_REQUIRES_CAPTURE = "requires_capture";
    static final String PI_CANCELED = "canceled";
    private static final int HOLD_ERROR_MAX_LENGTH = 255;
    private static final DateTimeFormatter EXPIRY_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    /** Issue d'une demande de pré-autorisation. */
    public enum HoldOutcome {
        /** Fonds bloqués jusqu'à {@code holdExpiresAt}. */
        PLACED,
        /** Hors de la fenêtre de pose : la caution reste PENDING, le scheduler la posera le jour J. */
        NOT_DUE,
        /** Refus définitif (carte refusée, authentification requise…) : FAILED + notification. */
        DECLINED,
        /** Stripe injoignable ou état concurrent : aucune transition, reprise au passage suivant. */
        UNAVAILABLE
    }

    private final SecurityDepositRepository repository;
    private final StripeGateway stripeGateway;
    private final NotificationService notificationService;
    private final Clock clock;

    public SecurityDepositHoldService(SecurityDepositRepository repository,
                                      StripeGateway stripeGateway,
                                      NotificationService notificationService,
                                      Clock clock) {
        this.repository = repository;
        this.stripeGateway = stripeGateway;
        this.notificationService = notificationService;
        this.clock = clock;
    }

    /** La réservation porte-t-elle une carte réutilisable hors session ? */
    public static boolean hasSavedCard(Reservation reservation) {
        return isPresent(reservation.getStripeCustomerId()) && isPresent(reservation.getStripePaymentMethodId());
    }

    /** Pose le hold si le jour de l'arrivée est venu ; sinon la caution attend (PENDING / FAILED). */
    public HoldOutcome placeHoldIfDue(SecurityDeposit deposit, Reservation reservation) {
        if (!SecurityDepositHoldPolicy.isHoldDue(reservation, clock.instant())) {
            return HoldOutcome.NOT_DUE;
        }
        final SecurityDepositStatus from = deposit.getStatus();
        if (!hasSavedCard(reservation)) {
            recordHoldRefusal(deposit, reservation, from, "no_saved_card");
            return HoldOutcome.DECLINED;
        }
        final PaymentIntent hold;
        try {
            hold = stripeGateway.createPaymentIntent(holdParams(deposit, reservation), holdIdempotencyKey(deposit));
        } catch (CardException | InvalidRequestException e) {
            recordHoldRefusal(deposit, reservation, from, describeRefusal(e));
            return HoldOutcome.DECLINED;
        } catch (StripeException e) {
            log.error("Caution {} : Stripe indisponible pour la pré-autorisation ({}) — nouvel essai au prochain passage",
                deposit.getId(), e.getMessage());
            return HoldOutcome.UNAVAILABLE;
        }
        if (!PI_REQUIRES_CAPTURE.equals(hold.getStatus())) {
            recordHoldRefusal(deposit, reservation, from, "status_" + hold.getStatus());
            return HoldOutcome.DECLINED;
        }
        final Instant expiresAt = captureBefore(hold);
        if (repository.markHoldPlaced(deposit.getId(), deposit.getOrganizationId(), from, hold.getId(), expiresAt) == 0) {
            return onHoldRaceLost(deposit, hold.getId());
        }
        log.info("Caution {} (résa {}) : hold {} posé jusqu'au {}",
            deposit.getId(), deposit.getReservationId(), hold.getId(), expiresAt);
        return HoldOutcome.PLACED;
    }

    /**
     * Remplace le hold courant avant son échéance : nouveau hold off-session d'abord, bascule en
     * base (CAS sur l'ancien), puis annulation de l'ancien — la caution n'est jamais découverte.
     * Une seule tentative par hold (clé d'idempotence liée à l'ancien PaymentIntent) : un refus est
     * noté et notifié, le hold courant restant valable jusqu'à son échéance.
     */
    public void renewHold(SecurityDeposit deposit, Reservation reservation) {
        final String previousRef = deposit.getExternalRef();
        final PaymentIntent renewed;
        try {
            renewed = stripeGateway.createPaymentIntent(holdParams(deposit, reservation), "deposit-renew-" + previousRef);
        } catch (CardException | InvalidRequestException e) {
            recordRenewalRefusal(deposit, reservation, describeRefusal(e));
            return;
        } catch (StripeException e) {
            log.error("Caution {} : Stripe indisponible pour le renouvellement du hold {} ({}) — nouvel essai au prochain passage",
                deposit.getId(), previousRef, e.getMessage());
            return;
        }
        if (!PI_REQUIRES_CAPTURE.equals(renewed.getStatus())) {
            recordRenewalRefusal(deposit, reservation, "status_" + renewed.getStatus());
            return;
        }
        final Instant expiresAt = captureBefore(renewed);
        if (repository.markHoldRenewed(deposit.getId(), deposit.getOrganizationId(), previousRef, renewed.getId(), expiresAt) == 0) {
            log.warn("Caution {} : capturée ou libérée pendant le renouvellement — nouveau hold {} annulé",
                deposit.getId(), renewed.getId());
            cancelOrphan(deposit, renewed.getId());
            return;
        }
        log.info("Caution {} : hold renouvelé {} -> {} jusqu'au {}", deposit.getId(), previousRef, renewed.getId(), expiresAt);
        try {
            // Sans cette annulation, la caution serait bloquée deux fois sur la carte du voyageur.
            cancelAuthorization(previousRef, "deposit-release-" + previousRef);
        } catch (StripeException e) {
            log.error("Caution {} : ancien hold {} non annulé ({}) — il échoira de lui-même le {}",
                deposit.getId(), previousRef, e.getMessage(), deposit.getHoldExpiresAt());
        }
    }

    /** Hold arrivé à échéance : si Stripe l'a bien annulé, la caution quitte HELD. */
    public void reconcileLapsedHold(SecurityDeposit deposit, Reservation reservation) {
        final PaymentIntent hold;
        try {
            hold = stripeGateway.retrievePaymentIntent(deposit.getExternalRef());
        } catch (StripeException e) {
            log.error("Caution {} : lecture du hold {} impossible ({}) — nouvel essai au prochain passage",
                deposit.getId(), deposit.getExternalRef(), e.getMessage());
            return;
        }
        if (PI_CANCELED.equals(hold.getStatus())) {
            recordLapse(deposit, reservation);
        } else if (!PI_REQUIRES_CAPTURE.equals(hold.getStatus())) {
            log.warn("Caution {} : hold {} au statut Stripe {} alors que la base dit HELD — à vérifier",
                deposit.getId(), hold.getId(), hold.getStatus());
        }
        // requires_capture : Stripe annule peu après capture_before, le prochain passage le constatera.
    }

    /**
     * Hold échu chez Stripe : RELEASED s'il n'y avait plus rien à garantir (fenêtre de réclamation
     * close, réservation annulée), sinon EXPIRED + alerte — la caution ne couvre plus rien.
     *
     * @return le statut appliqué, ou {@code null} si la caution a changé d'état entre-temps
     */
    public SecurityDepositStatus recordLapse(SecurityDeposit deposit, Reservation reservation) {
        final SecurityDepositStatus outcome = SecurityDepositHoldPolicy.nothingLeftToGuarantee(reservation, clock.instant())
            ? SecurityDepositStatus.RELEASED
            : SecurityDepositStatus.EXPIRED;
        if (repository.markHoldLapsed(deposit.getId(), deposit.getOrganizationId(), outcome) == 0) {
            return null;
        }
        if (outcome == SecurityDepositStatus.EXPIRED) {
            log.warn("Caution {} (résa {}) : hold {} échu pendant la fenêtre de réclamation",
                deposit.getId(), deposit.getReservationId(), deposit.getExternalRef());
            notifyOrg(deposit, reservation, NotificationKey.SECURITY_DEPOSIT_HOLD_EXPIRED,
                "Caution expirée",
                "La pré-autorisation de la caution de " + amountOf(deposit) + " (réservation "
                    + reservation.getConfirmationCode() + ") a expiré chez la banque du voyageur : "
                    + "aucun fonds n'est plus bloqué. Des dégâts constatés ne pourront plus être prélevés sur cette caution.");
        } else {
            log.info("Caution {} : hold {} échu après la fenêtre de réclamation — libérée", deposit.getId(), deposit.getExternalRef());
        }
        return outcome;
    }

    /**
     * Annule un hold Stripe. Un hold déjà annulé (échu) n'a plus rien à libérer : aucun appel —
     * sans quoi la libération d'une caution échue échouerait en boucle.
     *
     * @return {@code true} si le hold était déjà échu
     */
    public boolean cancelAuthorization(String paymentIntentId, String idempotencyKey) throws StripeException {
        final PaymentIntent hold = stripeGateway.retrievePaymentIntent(paymentIntentId);
        if (PI_CANCELED.equals(hold.getStatus())) {
            return true;
        }
        stripeGateway.cancelPaymentIntent(hold, idempotencyKey);
        return false;
    }

    // ─── Refus ────────────────────────────────────────────────────────────────

    private void recordHoldRefusal(SecurityDeposit deposit, Reservation reservation,
                                   SecurityDepositStatus from, String refusal) {
        if (repository.markHoldFailed(deposit.getId(), deposit.getOrganizationId(), from, refusal) == 0) {
            log.warn("Caution {} : refus {} non enregistré, l'état a changé entre-temps", deposit.getId(), refusal);
            return;
        }
        log.warn("Caution {} (résa {}) : pré-autorisation refusée ({})", deposit.getId(), deposit.getReservationId(), refusal);
        notifyOrg(deposit, reservation, NotificationKey.SECURITY_DEPOSIT_HOLD_FAILED,
            "Caution non pré-autorisée",
            "La caution de " + amountOf(deposit) + " (réservation " + reservation.getConfirmationCode()
                + ") n'a pas pu être pré-autorisée sur la carte du voyageur (" + refusal + "). " + adviceFor(refusal));
    }

    private void recordRenewalRefusal(SecurityDeposit deposit, Reservation reservation, String refusal) {
        if (repository.markRenewalFailed(deposit.getId(), deposit.getOrganizationId(), deposit.getExternalRef(), refusal) == 0) {
            return;
        }
        log.warn("Caution {} (résa {}) : renouvellement du hold refusé ({})", deposit.getId(), deposit.getReservationId(), refusal);
        notifyOrg(deposit, reservation, NotificationKey.SECURITY_DEPOSIT_HOLD_FAILED,
            "Caution : renouvellement refusé",
            "La pré-autorisation de la caution de " + amountOf(deposit) + " (réservation "
                + reservation.getConfirmationCode() + ") n'a pas pu être renouvelée (" + refusal + "). "
                + "Elle reste valable jusqu'au " + formatExpiry(deposit, reservation)
                + " : en cas de dégâts, capturez-la avant cette date.");
    }

    private static String adviceFor(String refusal) {
        if (refusal.startsWith("authentication_required")) {
            return "La banque exige que le voyageur s'authentifie (3-D Secure) : demandez-lui une autre carte "
                + "ou une caution sur place.";
        }
        return "Contactez le voyageur pour une autre carte ou une caution sur place.";
    }

    static String describeRefusal(StripeException e) {
        final String code = e.getCode() != null ? e.getCode() : e.getClass().getSimpleName();
        final String decline = e instanceof CardException card ? card.getDeclineCode() : null;
        final String refusal = decline != null && !decline.equals(code) ? code + "/" + decline : code;
        return refusal.length() > HOLD_ERROR_MAX_LENGTH ? refusal.substring(0, HOLD_ERROR_MAX_LENGTH) : refusal;
    }

    // ─── Stripe ───────────────────────────────────────────────────────────────

    private static PaymentIntentCreateParams holdParams(SecurityDeposit deposit, Reservation reservation) {
        return PaymentIntentCreateParams.builder()
            .setAmount(StripeAmounts.toMinorUnits(deposit.getAmount()))
            .setCurrency(currencyOf(deposit, reservation).toLowerCase(Locale.ROOT))
            .setCaptureMethod(PaymentIntentCreateParams.CaptureMethod.MANUAL)
            .setCustomer(reservation.getStripeCustomerId())
            .setPaymentMethod(reservation.getStripePaymentMethodId())
            .setOffSession(true)
            .setConfirm(true)
            .addExpand("latest_charge") // capture_before sans second appel
            .putMetadata("depositId", String.valueOf(deposit.getId()))
            .putMetadata("reservationId", String.valueOf(deposit.getReservationId()))
            .setDescription("Caution réservation #" + deposit.getReservationId())
            .build();
    }

    /** Une clé par tentative : Stripe rejouerait sinon le refus précédent pendant 24 h. */
    private static String holdIdempotencyKey(SecurityDeposit deposit) {
        return deposit.getHoldAttempts() == 0
            ? "deposit-hold-" + deposit.getId()
            : "deposit-hold-" + deposit.getId() + "-" + deposit.getHoldAttempts();
    }

    private Instant captureBefore(PaymentIntent hold) {
        final Charge charge = hold.getLatestChargeObject();
        final Long epochSeconds = charge != null && charge.getPaymentMethodDetails() != null
            && charge.getPaymentMethodDetails().getCard() != null
            ? charge.getPaymentMethodDetails().getCard().getCaptureBefore()
            : null;
        if (epochSeconds != null) {
            return Instant.ofEpochSecond(epochSeconds);
        }
        log.warn("Hold {} : capture_before absent — échéance supposée sur la fenêtre la plus courte ({})",
            hold.getId(), SecurityDepositHoldPolicy.SHORTEST_VALIDITY);
        return clock.instant().plus(SecurityDepositHoldPolicy.SHORTEST_VALIDITY);
    }

    /**
     * CAS perdu après un hold réussi. Même clé d'idempotence = même PaymentIntent : s'il est déjà
     * enregistré, un passage concurrent l'a posé. Sinon il n'est référencé par personne et
     * bloquerait les fonds du voyageur jusqu'à son échéance : on l'annule.
     */
    private HoldOutcome onHoldRaceLost(SecurityDeposit deposit, String paymentIntentId) {
        final boolean recorded = repository.findById(deposit.getId())
            .map(current -> paymentIntentId.equals(current.getExternalRef()))
            .orElse(false);
        if (recorded) {
            return HoldOutcome.PLACED;
        }
        log.warn("Caution {} : état changé pendant la pré-autorisation — hold {} annulé", deposit.getId(), paymentIntentId);
        cancelOrphan(deposit, paymentIntentId);
        return HoldOutcome.UNAVAILABLE;
    }

    private void cancelOrphan(SecurityDeposit deposit, String paymentIntentId) {
        try {
            cancelAuthorization(paymentIntentId, "deposit-orphan-" + paymentIntentId);
        } catch (StripeException e) {
            log.error("Caution {} : hold orphelin {} non annulé ({}) — fonds du voyageur bloqués jusqu'à son échéance",
                deposit.getId(), paymentIntentId, e.getMessage());
        }
    }

    // ─── Notification ─────────────────────────────────────────────────────────

    private void notifyOrg(SecurityDeposit deposit, Reservation reservation, NotificationKey key,
                           String title, String message) {
        notificationService.notifyAdminsAndManagersByOrgId(deposit.getOrganizationId(), key, title, message,
            "/reservations?highlight=" + reservation.getId());
    }

    private static String amountOf(SecurityDeposit deposit) {
        final String currency = deposit.getCurrency() != null ? deposit.getCurrency() : "";
        return (deposit.getAmount().toPlainString() + " " + currency).trim();
    }

    private static String formatExpiry(SecurityDeposit deposit, Reservation reservation) {
        return deposit.getHoldExpiresAt() == null ? "son échéance"
            : EXPIRY_FORMAT.format(deposit.getHoldExpiresAt().atZone(SecurityDepositHoldPolicy.zoneOf(reservation.getProperty())));
    }

    private static String currencyOf(SecurityDeposit deposit, Reservation reservation) {
        if (isPresent(deposit.getCurrency())) {
            return deposit.getCurrency();
        }
        return isPresent(reservation.getCurrency()) ? reservation.getCurrency() : "EUR";
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }
}
