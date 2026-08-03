package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.StayTransfer;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.StayTransferRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * M11 v2 — relogement avec accord EXPLICITE du voyageur. {@link #propose} envoie
 * l'offre (email + lien de confirmation, validité {@link StayTransfer#EXPIRY_HOURS} h) ;
 * {@link #confirm} — appelé par le lien PUBLIC — exécute alors le chemin canonique
 * {@code ReservationService.relodge} (calendrier arbitré, ménage suivi, codes
 * régénérés) sous verrou CAS : un double clic ne reloge pas deux fois, un conflit
 * calendrier survenu entre-temps annule proprement la proposition.
 */
@Service
public class StayTransferService {

    private static final Logger log = LoggerFactory.getLogger(StayTransferService.class);

    /** Payload de la page publique — jamais l'entité (règle audit n°5). */
    public record PublicTransferView(String status, String guestFirstName,
                                     String fromPropertyName, String toPropertyName,
                                     String toPropertyAddress, LocalDate checkIn,
                                     LocalDate checkOut, String reason, Instant expiresAt) {}

    private final StayTransferRepository stayTransferRepository;
    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final ObjectProvider<ReservationService> reservationService;
    private final EmailService emailService;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final com.clenzy.service.agent.supervision.SupervisionActivityService activityService;
    private final Clock clock;

    @Value("${clenzy.app.url:https://app.clenzy.fr}")
    private String appBaseUrl;

    public StayTransferService(StayTransferRepository stayTransferRepository,
                               ReservationRepository reservationRepository,
                               PropertyRepository propertyRepository,
                               CalendarDayRepository calendarDayRepository,
                               ObjectProvider<ReservationService> reservationService,
                               EmailService emailService,
                               TenantScopedExecutor tenantScopedExecutor,
                               com.clenzy.service.agent.supervision.SupervisionActivityService activityService,
                               Clock clock) {
        this.stayTransferRepository = stayTransferRepository;
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.reservationService = reservationService;
        this.emailService = emailService;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.activityService = activityService;
        this.clock = clock;
    }

    /**
     * Crée la proposition et envoie l'offre au voyageur. Toutes les conditions sont
     * validées ICI (séjour actif, org, cible libre sur les nuits restantes, email
     * présent, pas de proposition déjà active) — l'email est un effet externe :
     * l'appelant (exécuteur de carte) passe par le chemin hors transaction.
     */
    public StayTransfer propose(Long orgId, Long reservationId, Long targetPropertyId,
                                String reason, String proposedBy) {
        final Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new NotFoundException("Réservation introuvable"));
        if (reservation.getOrganizationId() == null
                || !reservation.getOrganizationId().equals(orgId)) {
            throw new IllegalStateException("Réservation introuvable pour cette organisation");
        }
        if ("cancelled".equalsIgnoreCase(reservation.getStatus())) {
            throw new IllegalStateException("Séjour annulé — relogement sans objet");
        }
        final LocalDate today = LocalDate.now(clock);
        if (reservation.getCheckOut() == null || !reservation.getCheckOut().isAfter(today)) {
            throw new IllegalStateException("Séjour terminé — relogement sans objet");
        }
        final Property target = propertyRepository.findById(targetPropertyId)
                .orElseThrow(() -> new IllegalStateException("Logement cible introuvable"));
        if (!orgId.equals(target.getOrganizationId())) {
            throw new IllegalStateException("Logement cible hors de votre organisation");
        }
        final String email = resolveGuestEmail(reservation);
        if (email == null) {
            throw new IllegalStateException("Voyageur sans email — proposer le relogement "
                    + "manuellement (téléphone / conversation)");
        }
        if (stayTransferRepository.existsByOrganizationIdAndReservationIdAndStatus(
                orgId, reservationId, StayTransfer.Status.PROPOSED)) {
            throw new IllegalStateException("Une proposition de relogement est déjà en attente "
                    + "de réponse du voyageur pour ce séjour");
        }
        // Cible libre sur les nuits restantes — vérification légère ; l'arbitrage
        // final (verrou calendrier) reste dans relodge() au moment de la confirmation.
        final LocalDate firstNight = reservation.getCheckIn() != null
                && reservation.getCheckIn().isAfter(today) ? reservation.getCheckIn() : today;
        final boolean targetBusy = !calendarDayRepository.findByPropertyAndDateRange(
                targetPropertyId, firstNight, reservation.getCheckOut().minusDays(1), orgId).isEmpty();
        if (targetBusy) {
            throw new IllegalStateException("Le logement cible n'est plus libre sur les nuits "
                    + "restantes — carte à rejeter");
        }

        final StayTransfer transfer = new StayTransfer();
        transfer.setOrganizationId(orgId);
        transfer.setReservationId(reservationId);
        transfer.setFromPropertyId(reservation.getProperty() != null
                ? reservation.getProperty().getId() : targetPropertyId);
        transfer.setToPropertyId(targetPropertyId);
        transfer.setReason(reason);
        transfer.setConfirmToken(UUID.randomUUID());
        transfer.setExpiresAt(Instant.now(clock).plus(StayTransfer.EXPIRY_HOURS, ChronoUnit.HOURS));
        transfer.setProposedBy(proposedBy);
        final StayTransfer saved = stayTransferRepository.save(transfer);

        sendProposalEmail(email, reservation, target, saved);
        log.info("Relogement PROPOSÉ org={} réservation={} cible={} (transfert {})",
                orgId, reservationId, targetPropertyId, saved.getId());
        return saved;
    }

    /** Payload de la page publique — le token est l'autorisation. */
    public PublicTransferView getPublicView(UUID token) {
        final StayTransfer transfer = stayTransferRepository.findByConfirmToken(token)
                .orElseThrow(() -> new NotFoundException("Proposition introuvable"));
        final Reservation reservation = reservationRepository
                .findById(transfer.getReservationId()).orElse(null);
        final Property from = propertyRepository.findById(transfer.getFromPropertyId()).orElse(null);
        final Property to = propertyRepository.findById(transfer.getToPropertyId()).orElse(null);
        final boolean expired = transfer.getStatus() == StayTransfer.Status.PROPOSED
                && transfer.getExpiresAt().isBefore(Instant.now(clock));
        final String guestFirstName = reservation != null && reservation.getGuestName() != null
                ? reservation.getGuestName().strip().split("\\s+")[0] : null;
        return new PublicTransferView(
                expired ? "EXPIRED" : transfer.getStatus().name(),
                guestFirstName,
                from != null ? from.getName() : null,
                to != null ? to.getName() : null,
                to != null ? to.getAddress() : null,
                reservation != null ? reservation.getCheckIn() : null,
                reservation != null ? reservation.getCheckOut() : null,
                transfer.getReason(), transfer.getExpiresAt());
    }

    /**
     * Confirmation par le voyageur (lien public, AUCUN contexte tenant) : verrou CAS
     * PROPOSED → CONFIRMED puis exécution du relogement canonique dans le contexte de
     * l'org du transfert. Échec d'exécution (conflit calendrier apparu entre-temps) →
     * proposition CANCELLED + l'équipe est prévenue via le feed — le voyageur voit un
     * message d'excuse, jamais une erreur brute.
     */
    public PublicTransferView confirm(UUID token) {
        final StayTransfer transfer = stayTransferRepository.findByConfirmToken(token)
                .orElseThrow(() -> new NotFoundException("Proposition introuvable"));
        if (transfer.getStatus() == StayTransfer.Status.DONE) {
            return getPublicView(token); // double clic → idempotent
        }
        if (transfer.getStatus() != StayTransfer.Status.PROPOSED) {
            throw new IllegalStateException("Cette proposition n'est plus active");
        }
        if (transfer.getExpiresAt().isBefore(Instant.now(clock))) {
            throw new IllegalStateException("Cette proposition a expiré — contactez votre hôte");
        }
        if (stayTransferRepository.markConfirmed(transfer.getId(), Instant.now(clock)) == 0) {
            return getPublicView(token); // course entre deux clics : le premier a gagné
        }
        try {
            tenantScopedExecutor.runAsOrganization(transfer.getOrganizationId(), () ->
                    reservationService.getObject().relodge(transfer.getReservationId(),
                            transfer.getToPropertyId(), "guest:stay-transfer:" + transfer.getId()));
            stayTransferRepository.markDone(transfer.getId(), Instant.now(clock));
            recordFeed(transfer, "Relogement confirmé par le voyageur — séjour déplacé");
        } catch (Exception e) {
            stayTransferRepository.markCancelled(transfer.getId(), Instant.now(clock));
            recordFeed(transfer, "Relogement accepté par le voyageur mais exécution impossible ("
                    + e.getMessage() + ") — reprendre contact");
            log.warn("Relogement confirmé mais exécution en échec (transfert {}) : {}",
                    transfer.getId(), e.getMessage());
            throw new IllegalStateException("Le relogement n'a pas pu être appliqué — "
                    + "votre hôte a été prévenu et revient vers vous");
        }
        return getPublicView(token);
    }

    /** Refus par le voyageur : la carte côté hôte redevient un sujet de conversation. */
    public PublicTransferView decline(UUID token) {
        final StayTransfer transfer = stayTransferRepository.findByConfirmToken(token)
                .orElseThrow(() -> new NotFoundException("Proposition introuvable"));
        if (transfer.getStatus() == StayTransfer.Status.PROPOSED) {
            stayTransferRepository.markCancelled(transfer.getId(), Instant.now(clock));
            recordFeed(transfer, "Relogement refusé par le voyageur — trouver une alternative");
        }
        return getPublicView(token);
    }

    /** Email du voyageur : le contact du séjour d'abord, l'email de paiement en repli. */
    private static String resolveGuestEmail(Reservation reservation) {
        if (reservation.getGuest() != null && reservation.getGuest().getEmail() != null
                && !reservation.getGuest().getEmail().isBlank()) {
            return reservation.getGuest().getEmail().trim();
        }
        if (reservation.getPaymentLinkEmail() != null && !reservation.getPaymentLinkEmail().isBlank()) {
            return reservation.getPaymentLinkEmail().trim();
        }
        return null;
    }

    private void recordFeed(StayTransfer transfer, String summary) {
        activityService.recordModuleActNewTx(transfer.getOrganizationId(),
                transfer.getFromPropertyId(), "gst", "stay_transfer", summary);
    }

    private void sendProposalEmail(String email, Reservation reservation, Property target,
                                   StayTransfer transfer) {
        final String guest = reservation.getGuestName() != null && !reservation.getGuestName().isBlank()
                ? StringUtils.escapeHtml(reservation.getGuestName().strip()) : "Bonjour";
        final String link = appBaseUrl + "/transfer/" + transfer.getConfirmToken();
        final String body = "<p>" + guest + ",</p>"
                + "<p>Suite à un incident sur votre logement, nous vous proposons de poursuivre "
                + "votre séjour dans : <b>" + StringUtils.escapeHtml(target.getName()) + "</b>"
                + (target.getAddress() != null
                    ? " — " + StringUtils.escapeHtml(target.getAddress()) : "") + ".</p>"
                + "<p>Vos dates et votre tarif ne changent pas. Rien ne sera déplacé sans votre "
                + "accord : confirmez ou refusez en un clic ci-dessous (lien valable "
                + StayTransfer.EXPIRY_HOURS + " h).</p>"
                + "<p><a href=\"" + link + "\">Voir la proposition de relogement</a></p>"
                + "<p>Nous restons joignables pour toute question.</p>";
        emailService.sendSimpleHtmlEmail(email,
                "Proposition de relogement pour votre séjour — " + target.getName(), body);
    }
}
