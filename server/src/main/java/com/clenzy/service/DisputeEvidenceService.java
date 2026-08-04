package com.clenzy.service;

import com.clenzy.model.PaymentDispute;
import com.clenzy.model.Reservation;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.GuestDeclarationRepository;
import com.clenzy.repository.PaymentDisputeRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import com.stripe.param.DisputeUpdateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

/**
 * Dossier de litige bancaire (M6, vague M-B) : assemble les preuves depuis NOS
 * données (séjour, fiche voyageur, livret transmis) et les dépose via l'API Stripe.
 * L'appel externe se fait HORS transaction (l'appelant est l'exécuteur de
 * supervision, chemin « effet externe ») ; la transition OPEN → SUBMITTED est un
 * CAS et l'idempotency key Stripe absorbe les re-tentatives.
 */
@Service
public class DisputeEvidenceService {

    private static final Logger log = LoggerFactory.getLogger(DisputeEvidenceService.class);

    private final PaymentDisputeRepository disputeRepository;
    private final ReservationRepository reservationRepository;
    private final GuestDeclarationRepository guestDeclarationRepository;
    private final WelcomeGuideTokenRepository welcomeGuideTokenRepository;
    private final StripeGateway stripeGateway;
    private final Clock clock;

    public DisputeEvidenceService(PaymentDisputeRepository disputeRepository,
                                  ReservationRepository reservationRepository,
                                  GuestDeclarationRepository guestDeclarationRepository,
                                  WelcomeGuideTokenRepository welcomeGuideTokenRepository,
                                  StripeGateway stripeGateway,
                                  Clock clock) {
        this.disputeRepository = disputeRepository;
        this.reservationRepository = reservationRepository;
        this.guestDeclarationRepository = guestDeclarationRepository;
        this.welcomeGuideTokenRepository = welcomeGuideTokenRepository;
        this.stripeGateway = stripeGateway;
        this.clock = clock;
    }

    /**
     * Assemble et DÉPOSE les preuves du litige. Échec explicite si le litige est
     * introuvable, déjà soumis, ou si Stripe refuse — la carte HITL reste alors
     * PENDING et un re-apply retente (idempotency key stable).
     */
    public void submitEvidence(Long disputeId, Long orgId) {
        final PaymentDispute dispute = disputeRepository.findByIdAndOrganizationId(disputeId, orgId)
                .orElseThrow(() -> new IllegalStateException("Litige introuvable pour cette organisation"));
        if (dispute.getStatus() != PaymentDispute.Status.OPEN) {
            throw new IllegalStateException("Litige déjà " + dispute.getStatus()
                    + " — plus rien à soumettre");
        }

        final DisputeUpdateParams.Evidence.Builder evidence = DisputeUpdateParams.Evidence.builder();
        final StringBuilder summary = new StringBuilder(
                "Séjour réservé et honoré via la plateforme Baitly. ");
        if (dispute.getReservationId() != null) {
            final Reservation reservation = reservationRepository
                    .findById(dispute.getReservationId()).orElse(null);
            if (reservation != null && orgId.equals(reservation.getOrganizationId())) {
                if (reservation.getGuestName() != null && !reservation.getGuestName().isBlank()) {
                    evidence.setCustomerName(reservation.getGuestName().strip());
                }
                if (reservation.getCheckIn() != null) {
                    evidence.setServiceDate(reservation.getCheckIn().toString());
                }
                summary.append("Réservation ").append(reservation.getConfirmationCode() != null
                                ? reservation.getConfirmationCode() : "#" + reservation.getId())
                        .append(", séjour du ").append(reservation.getCheckIn())
                        .append(" au ").append(reservation.getCheckOut()).append(". ");
                if (!welcomeGuideTokenRepository.findByReservationId(reservation.getId()).isEmpty()) {
                    summary.append("Livret d'accueil (accès, wifi, instructions) transmis au voyageur. ");
                }
                if (!guestDeclarationRepository
                        .findByReservationIdOrderByIdAsc(reservation.getId()).isEmpty()) {
                    summary.append("Fiche d'enregistrement voyageur complétée (identité vérifiée). ");
                }
            }
        }
        summary.append("Conditions d'annulation acceptées au paiement.");
        evidence.setUncategorizedText(summary.toString());

        try {
            stripeGateway.updateDispute(dispute.getProviderDisputeId(),
                    DisputeUpdateParams.builder()
                            .setEvidence(evidence.build())
                            .setSubmit(true)
                            .build(),
                    "dispute-evidence-" + dispute.getId());
        } catch (Exception e) {
            throw new IllegalStateException("Dépôt des preuves refusé par Stripe : " + e.getMessage(), e);
        }
        markSubmitted(dispute.getId(), orgId);
        log.info("CHARGEBACK_SUBMIT : preuves déposées (dispute {}, org {})",
                dispute.getProviderDisputeId(), orgId);
    }

    @Transactional
    void markSubmitted(Long disputeId, Long orgId) {
        disputeRepository.markSubmitted(disputeId, orgId, clock.instant());
    }
}
