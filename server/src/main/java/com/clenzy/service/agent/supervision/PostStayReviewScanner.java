package com.clenzy.service.agent.supervision;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.WelcomeGuideService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Règle de scan DÉTERMINISTE (agent Voyageur « gst », constellation métiers Phase 2) :
 * pour chaque séjour terminé la VEILLE — dans la timezone de la propriété, jamais la
 * zone système (règle audit n°9) — propose l'envoi d'une demande d'avis post-séjour
 * (carte HITL {@code REVIEW_REQUEST_SEND}).
 *
 * <p>Conditions : logement avec livret PUBLIÉ (le lien d'avis est porté par le livret,
 * cf. {@link WelcomeGuideService#reviewLinkForReservation}), voyageur avec un email
 * résoluble. Le lien d'avis n'est généré qu'à l'apply — la carte ne crée aucun token.</p>
 *
 * <p>Zéro coût token (heuristique pure). Déduplication par intitulé stable incluant
 * l'ID de réservation (plusieurs départs successifs possibles sur le même logement).
 * Best-effort : toute erreur est absorbée (jamais sur le chemin critique d'un scan).</p>
 */
@Service
public class PostStayReviewScanner {

    private static final Logger log = LoggerFactory.getLogger(PostStayReviewScanner.class);

    private static final ZoneId DEFAULT_PROPERTY_ZONE = ZoneId.of("Europe/Paris");
    private static final String MODULE_GST = "gst";

    private final ReservationRepository reservationRepository;
    private final WelcomeGuideService welcomeGuideService;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public PostStayReviewScanner(ReservationRepository reservationRepository,
                                 WelcomeGuideService welcomeGuideService,
                                 SupervisionSuggestionService suggestionService,
                                 Clock clock) {
        this.reservationRepository = reservationRepository;
        this.welcomeGuideService = welcomeGuideService;
        this.suggestionService = suggestionService;
        this.clock = clock;
    }

    /** Évalue la règle pour un logement et émet les cartes HITL correspondantes. */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            // Fenêtre large en zone système pour le repository, filtrage précis « départ
            // hier » dans la timezone de LA propriété ensuite (règle audit n°9).
            final LocalDate today = LocalDate.now(clock);
            final List<Reservation> recent = reservationRepository
                    .findRecentCheckoutsByPropertyId(propertyId, today.minusDays(2), today.plusDays(1), orgId);

            for (Reservation reservation : recent) {
                final ZoneId zone = resolveZone(reservation.getProperty());
                final LocalDate yesterday = LocalDate.now(clock.withZone(zone)).minusDays(1);
                if (!yesterday.equals(reservation.getCheckOut())) {
                    continue; // pas un départ d'hier (dans la zone du logement)
                }
                if (resolveGuestEmail(reservation) == null) {
                    continue; // aucun email résoluble → rien à proposer
                }
                if (!welcomeGuideService.hasPublishedGuideFor(reservation)) {
                    continue; // pas de livret publié → pas de lien d'avis à offrir
                }
                emitReviewRequest(orgId, propertyId, reservation);
            }
        } catch (Exception e) {
            log.debug("post-stay review scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    private void emitReviewRequest(Long orgId, Long propertyId, Reservation reservation) {
        final String guestName = reservation.getGuestName() != null
                && !reservation.getGuestName().isBlank()
                ? reservation.getGuestName().strip()
                : "le voyageur";
        // L'ID de réservation dans le titre : plusieurs départs successifs possibles
        // sur le même logement, chacun mérite sa propre carte (dédup par intitulé).
        suggestionService.recordActionableStrict(
                orgId, propertyId, MODULE_GST, reservation.getId(),
                "Demande d'avis à envoyer (réservation #" + reservation.getId() + ")",
                "Séjour de " + guestName + " terminé hier, sans incident signalé. « Envoyer » "
                        + "adresse la demande d'avis avec un lien à durée bornée — solliciter "
                        + "sous 24-48 h maximise le taux de réponse.",
                SupervisionActionType.REVIEW_REQUEST_SEND,
                "{\"reservationId\":" + reservation.getId() + "}", null, "info");
    }

    /** Email du voyageur : le contact du séjour d'abord, l'email de paiement en repli. */
    static String resolveGuestEmail(Reservation reservation) {
        if (reservation.getGuest() != null && reservation.getGuest().getEmail() != null
                && !reservation.getGuest().getEmail().isBlank()) {
            return reservation.getGuest().getEmail().trim();
        }
        if (reservation.getPaymentLinkEmail() != null && !reservation.getPaymentLinkEmail().isBlank()) {
            return reservation.getPaymentLinkEmail().trim();
        }
        return null;
    }

    /** Timezone de la propriété, repli {@code Europe/Paris} (règle audit n°9). */
    private ZoneId resolveZone(Property property) {
        if (property == null) {
            return DEFAULT_PROPERTY_ZONE;
        }
        final String tz = property.getTimezone();
        if (tz == null || tz.isBlank()) {
            return DEFAULT_PROPERTY_ZONE;
        }
        try {
            return ZoneId.of(tz.strip());
        } catch (Exception e) {
            return DEFAULT_PROPERTY_ZONE;
        }
    }
}
