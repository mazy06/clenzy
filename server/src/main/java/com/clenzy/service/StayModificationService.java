package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Reservation;
import com.clenzy.model.StayModification;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.StayModificationRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * STAY_MODIFICATION v2 (vague M-D) — avenant de séjour avec accord EXPLICITE du
 * voyageur. {@link #propose} chiffre (PriceEngine) et envoie l'offre ;
 * {@link #confirm} — lien PUBLIC — RE-vérifie la disponibilité, RE-calcule le
 * total (règle argent n°1 : si le prix a MONTÉ entre-temps, la proposition est
 * annulée, jamais appliquée à un tarif supérieur au chiffrage accepté), puis
 * exécute le chemin canonique {@code ReservationService.reschedule} sous verrou CAS.
 *
 * <p>Différentiel : trop-perçu remboursé automatiquement (Stripe, best-effort —
 * un échec n'annule pas l'avenant, le feed prévient l'hôte) ; complément demandé
 * au voyageur et suivi côté hôte — l'encaissement automatisé d'un montant
 * arbitraire attend la vague 2 du chantier paiement multi-provider.</p>
 */
@Service
public class StayModificationService {

    private static final Logger log = LoggerFactory.getLogger(StayModificationService.class);

    /** Payload de la page publique — jamais l'entité (règle audit n°5). */
    public record PublicModificationView(String status, String guestFirstName,
                                         String propertyName, LocalDate currentCheckIn,
                                         LocalDate currentCheckOut, LocalDate newCheckIn,
                                         LocalDate newCheckOut, BigDecimal oldTotal,
                                         BigDecimal newTotal, BigDecimal priceDelta,
                                         Instant expiresAt) {}

    private final StayModificationRepository stayModificationRepository;
    private final ReservationRepository reservationRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final PriceEngine priceEngine;
    private final ObjectProvider<ReservationService> reservationService;
    private final ObjectProvider<ReservationRefundService> reservationRefundService;
    private final EmailService emailService;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final com.clenzy.service.agent.supervision.SupervisionActivityService activityService;
    private final Clock clock;

    @Value("${clenzy.app.url:https://app.clenzy.fr}")
    private String appBaseUrl;

    public StayModificationService(StayModificationRepository stayModificationRepository,
                                   ReservationRepository reservationRepository,
                                   CalendarDayRepository calendarDayRepository,
                                   PriceEngine priceEngine,
                                   ObjectProvider<ReservationService> reservationService,
                                   ObjectProvider<ReservationRefundService> reservationRefundService,
                                   EmailService emailService,
                                   TenantScopedExecutor tenantScopedExecutor,
                                   com.clenzy.service.agent.supervision.SupervisionActivityService activityService,
                                   Clock clock) {
        this.stayModificationRepository = stayModificationRepository;
        this.reservationRepository = reservationRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.priceEngine = priceEngine;
        this.reservationService = reservationService;
        this.reservationRefundService = reservationRefundService;
        this.emailService = emailService;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.activityService = activityService;
        this.clock = clock;
    }

    /**
     * Chiffre et PROPOSE l'avenant au voyageur (email + lien, validité 72 h).
     * Effet externe (email) : l'appelant passe par le chemin hors transaction.
     */
    public StayModification propose(Long orgId, Long reservationId, LocalDate newCheckIn,
                                    LocalDate newCheckOut, String proposedBy) {
        if (newCheckIn == null || newCheckOut == null || !newCheckOut.isAfter(newCheckIn)) {
            throw new IllegalStateException("Dates demandées incohérentes");
        }
        final Reservation reservation = requireActiveOrgReservation(orgId, reservationId);
        final Long propertyId = reservation.getProperty().getId();
        final String email = resolveGuestEmail(reservation);
        if (email == null) {
            throw new IllegalStateException("Voyageur sans email — répondre dans la conversation");
        }
        if (stayModificationRepository.existsByOrganizationIdAndReservationIdAndStatus(
                orgId, reservationId, StayModification.Status.PROPOSED)) {
            throw new IllegalStateException("Un avenant est déjà en attente de réponse "
                    + "du voyageur pour ce séjour");
        }
        if (!isRangeFreeForReservation(orgId, propertyId, reservationId, newCheckIn, newCheckOut)) {
            throw new IllegalStateException("Les dates " + newCheckIn + " → " + newCheckOut
                    + " ne sont pas disponibles — proposer une alternative");
        }
        final BigDecimal newTotal = nightlyTotal(propertyId, orgId, newCheckIn, newCheckOut);
        final BigDecimal delta = reservation.getTotalPrice() != null
                ? newTotal.subtract(reservation.getTotalPrice()) : null;

        final StayModification modification = new StayModification();
        modification.setOrganizationId(orgId);
        modification.setReservationId(reservationId);
        modification.setNewCheckIn(newCheckIn);
        modification.setNewCheckOut(newCheckOut);
        modification.setOldTotal(reservation.getTotalPrice());
        modification.setNewTotal(newTotal);
        modification.setPriceDelta(delta);
        modification.setConfirmToken(UUID.randomUUID());
        modification.setExpiresAt(Instant.now(clock).plus(StayModification.EXPIRY_HOURS, ChronoUnit.HOURS));
        modification.setProposedBy(proposedBy);
        final StayModification saved = stayModificationRepository.save(modification);

        sendProposalEmail(email, reservation, saved);
        log.info("Avenant PROPOSÉ org={} réservation={} {}→{} total={} (avenant {})",
                orgId, reservationId, newCheckIn, newCheckOut, newTotal, saved.getId());
        return saved;
    }

    /** Payload de la page publique — le token est l'autorisation. */
    public PublicModificationView getPublicView(UUID token) {
        final StayModification modification = stayModificationRepository.findByConfirmToken(token)
                .orElseThrow(() -> new NotFoundException("Proposition introuvable"));
        final Reservation reservation = reservationRepository
                .findById(modification.getReservationId()).orElse(null);
        final boolean expired = modification.getStatus() == StayModification.Status.PROPOSED
                && modification.getExpiresAt().isBefore(Instant.now(clock));
        return new PublicModificationView(
                expired ? "EXPIRED" : modification.getStatus().name(),
                reservation != null && reservation.getGuestName() != null
                        ? reservation.getGuestName().strip().split("\\s+")[0] : null,
                reservation != null && reservation.getProperty() != null
                        ? reservation.getProperty().getName() : null,
                reservation != null ? reservation.getCheckIn() : null,
                reservation != null ? reservation.getCheckOut() : null,
                modification.getNewCheckIn(), modification.getNewCheckOut(),
                modification.getOldTotal(), modification.getNewTotal(),
                modification.getPriceDelta(), modification.getExpiresAt());
    }

    /**
     * Accord du voyageur (lien public, AUCUN contexte tenant). Dispo et total
     * RE-vérifiés sous le verrou CAS ; l'avenant ne s'applique JAMAIS à un tarif
     * supérieur au chiffrage accepté. Le différentiel est traité APRÈS l'avenant,
     * en best-effort : les dates confirmées ne se rollbackent pas sur un souci
     * d'argent — le feed dit à l'hôte quoi encaisser/rembourser.
     */
    public PublicModificationView confirm(UUID token) {
        final StayModification modification = stayModificationRepository.findByConfirmToken(token)
                .orElseThrow(() -> new NotFoundException("Proposition introuvable"));
        if (modification.getStatus() == StayModification.Status.DONE) {
            return getPublicView(token); // double clic → idempotent
        }
        if (modification.getStatus() != StayModification.Status.PROPOSED) {
            throw new IllegalStateException("Cette proposition n'est plus active");
        }
        if (modification.getExpiresAt().isBefore(Instant.now(clock))) {
            throw new IllegalStateException("Cette proposition a expiré — contactez votre hôte");
        }
        if (stayModificationRepository.markConfirmed(modification.getId(), Instant.now(clock)) == 0) {
            return getPublicView(token); // course entre deux clics : le premier a gagné
        }
        final Long orgId = modification.getOrganizationId();
        final Reservation reservation;
        final BigDecimal recomputedTotal;
        try {
            reservation = requireActiveOrgReservation(orgId, modification.getReservationId());
            final Long propertyId = reservation.getProperty().getId();
            if (!isRangeFreeForReservation(orgId, propertyId, reservation.getId(),
                    modification.getNewCheckIn(), modification.getNewCheckOut())) {
                throw new IllegalStateException("dates plus disponibles");
            }
            // RE-calcul (règle argent n°1) : hausse depuis le chiffrage accepté → refus.
            recomputedTotal = nightlyTotal(propertyId, orgId,
                    modification.getNewCheckIn(), modification.getNewCheckOut());
            if (modification.getNewTotal() != null
                    && recomputedTotal.compareTo(modification.getNewTotal()) > 0) {
                throw new IllegalStateException("tarif modifié depuis le chiffrage accepté");
            }
            tenantScopedExecutor.runAsOrganization(orgId, () ->
                    reservationService.getObject().reschedule(modification.getReservationId(),
                            modification.getNewCheckIn(), modification.getNewCheckOut(),
                            recomputedTotal, "guest:stay-modification:" + modification.getId()));
        } catch (Exception e) {
            stayModificationRepository.markCancelled(modification.getId(), Instant.now(clock));
            recordFeed(modification, null, "Avenant accepté par le voyageur mais exécution "
                    + "impossible (" + e.getMessage() + ") — reprendre contact");
            log.warn("Avenant confirmé mais exécution en échec (avenant {}) : {}",
                    modification.getId(), e.getMessage());
            throw new IllegalStateException("La modification n'a pas pu être appliquée — "
                    + "votre hôte a été prévenu et revient vers vous");
        }
        final BigDecimal delta = modification.getOldTotal() != null
                ? recomputedTotal.subtract(modification.getOldTotal()) : null;
        stayModificationRepository.markDone(modification.getId(), Instant.now(clock),
                recomputedTotal, delta);
        settleDelta(modification, reservation, delta);
        return getPublicView(token);
    }

    /** Refus du voyageur : proposition annulée, l'hôte prévenu via le feed. */
    public PublicModificationView decline(UUID token) {
        final StayModification modification = stayModificationRepository.findByConfirmToken(token)
                .orElseThrow(() -> new NotFoundException("Proposition introuvable"));
        if (modification.getStatus() == StayModification.Status.PROPOSED) {
            stayModificationRepository.markCancelled(modification.getId(), Instant.now(clock));
            recordFeed(modification, null, "Avenant refusé par le voyageur — poursuivre "
                    + "dans la conversation");
        }
        return getPublicView(token);
    }

    /**
     * Différentiel, APRÈS l'avenant appliqué (best-effort — jamais de rollback des
     * dates) : trop-perçu remboursé automatiquement en geste commercial (Stripe,
     * idempotent) ; complément → feed hôte (encaissement automatisé = vague 2 du
     * chantier paiement). Échec de remboursement (résa OTA, pas de session Stripe)
     * → feed « rembourser manuellement ».
     */
    private void settleDelta(StayModification modification, Reservation reservation,
                             BigDecimal delta) {
        if (delta == null || delta.signum() == 0) {
            recordFeed(modification, reservation,
                    "Avenant confirmé par le voyageur — dates déplacées, tarif inchangé");
            return;
        }
        if (delta.signum() < 0) {
            final BigDecimal overpaid = delta.negate();
            try {
                reservationRefundService.getObject().initiateRefund(
                        modification.getReservationId(), StripeAmounts.toMinorUnits(overpaid),
                        ReservationRefundService.REASON_GESTURE, modification.getOrganizationId());
                recordFeed(modification, reservation, "Avenant confirmé — trop-perçu de "
                        + overpaid + " € remboursé au voyageur");
            } catch (Exception e) {
                recordFeed(modification, reservation, "Avenant confirmé — rembourser "
                        + overpaid + " € manuellement (" + e.getMessage() + ")");
                log.warn("Remboursement du trop-perçu en échec (avenant {}) : {}",
                        modification.getId(), e.getMessage());
            }
            return;
        }
        recordFeed(modification, reservation, "Avenant confirmé — complément de " + delta
                + " € à encaisser auprès du voyageur (lien de paiement depuis la réservation)");
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Reservation requireActiveOrgReservation(Long orgId, Long reservationId) {
        final Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new NotFoundException("Réservation introuvable"));
        if (reservation.getOrganizationId() == null
                || !reservation.getOrganizationId().equals(orgId)) {
            throw new IllegalStateException("Réservation introuvable pour cette organisation");
        }
        if ("cancelled".equalsIgnoreCase(reservation.getStatus())) {
            throw new IllegalStateException("Séjour annulé — avenant sans objet");
        }
        if (reservation.getCheckOut() == null
                || reservation.getCheckOut().isBefore(LocalDate.now(clock))) {
            throw new IllegalStateException("Séjour terminé — avenant sans objet");
        }
        if (reservation.getProperty() == null) {
            throw new IllegalStateException("Réservation sans logement");
        }
        return reservation;
    }

    /** Nuits [from, to) libres, en ignorant les lignes du séjour à déplacer. */
    private boolean isRangeFreeForReservation(Long orgId, Long propertyId, Long reservationId,
                                              LocalDate checkIn, LocalDate checkOut) {
        return calendarDayRepository.findByPropertyAndDateRange(
                        propertyId, checkIn, checkOut.minusDays(1), orgId)
                .stream().allMatch(day -> day.getReservation() != null
                        && day.getReservation().getId().equals(reservationId));
    }

    private BigDecimal nightlyTotal(Long propertyId, Long orgId,
                                    LocalDate checkIn, LocalDate checkOut) {
        return priceEngine.resolvePriceRange(propertyId, checkIn, checkOut.minusDays(1), orgId)
                .values().stream()
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
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

    private void recordFeed(StayModification modification, Reservation reservation, String summary) {
        final Long propertyId = reservation != null && reservation.getProperty() != null
                ? reservation.getProperty().getId()
                : reservationRepository.findById(modification.getReservationId())
                        .map(r -> r.getProperty() != null ? r.getProperty().getId() : null)
                        .orElse(null);
        if (propertyId == null) {
            return;
        }
        activityService.recordModuleActNewTx(modification.getOrganizationId(), propertyId,
                "gst", "stay_modification", summary);
    }

    private void sendProposalEmail(String email, Reservation reservation,
                                   StayModification modification) {
        final String guest = reservation.getGuestName() != null && !reservation.getGuestName().isBlank()
                ? StringUtils.escapeHtml(reservation.getGuestName().strip()) : "Bonjour";
        final String link = appBaseUrl + "/stay-change/" + modification.getConfirmToken();
        final BigDecimal delta = modification.getPriceDelta();
        final String deltaLine = delta == null || delta.signum() == 0
                ? "Le tarif de votre séjour reste inchangé."
                : delta.signum() > 0
                    ? "Le nouveau total serait de " + modification.getNewTotal()
                        + " € (complément de " + delta + " €)."
                    : "Le nouveau total serait de " + modification.getNewTotal()
                        + " € — le trop-perçu de " + delta.negate()
                        + " € vous sera remboursé.";
        final String body = "<p>" + guest + ",</p>"
                + "<p>Suite à votre demande, voici la proposition de modification de votre "
                + "séjour : du <b>" + modification.getNewCheckIn() + "</b> au <b>"
                + modification.getNewCheckOut() + "</b>. " + StringUtils.escapeHtml(deltaLine) + "</p>"
                + "<p>Rien ne sera modifié sans votre accord : confirmez ou refusez en un clic "
                + "ci-dessous (lien valable " + StayModification.EXPIRY_HOURS + " h).</p>"
                + "<p><a href=\"" + link + "\">Voir la proposition de modification</a></p>";
        emailService.sendSimpleHtmlEmail(email,
                "Modification de votre séjour — proposition à confirmer", body);
    }
}
