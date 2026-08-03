package com.clenzy.service.agent.supervision;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.UpsellOffer;
import com.clenzy.model.UpsellType;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UpsellOfferRepository;
import com.clenzy.service.WelcomeGuideService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Règle de scan DÉTERMINISTE (agent Voyageur « gst », vague B) : fenêtres d'upsell
 * détectées sur le calendrier — early check-in la veille d'une arrivée SANS départ le
 * même jour, late checkout la veille d'un départ SANS arrivée le même jour — quand une
 * offre ACTIVE du bon type existe pour le logement. Carte {@code UPSELL_OFFER}
 * « Envoyer » : l'email porte l'offre et le lien du livret (l'achat reste le flux
 * Stripe du livret).
 *
 * <p>Conditions : email voyageur résoluble + livret publié (le lien d'achat vit dans
 * le livret). Dates comparées dans la timezone de LA propriété (règle audit n°9).
 * Dédup par intitulé (id de réservation). Best-effort.</p>
 */
@Service
public class GuestUpsellScanner {

    private static final Logger log = LoggerFactory.getLogger(GuestUpsellScanner.class);

    private static final ZoneId DEFAULT_PROPERTY_ZONE = ZoneId.of("Europe/Paris");
    private static final String MODULE_GST = "gst";

    private final ReservationRepository reservationRepository;
    private final UpsellOfferRepository upsellOfferRepository;
    private final WelcomeGuideService welcomeGuideService;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public GuestUpsellScanner(ReservationRepository reservationRepository,
                              UpsellOfferRepository upsellOfferRepository,
                              WelcomeGuideService welcomeGuideService,
                              SupervisionSuggestionService suggestionService,
                              Clock clock) {
        this.reservationRepository = reservationRepository;
        this.upsellOfferRepository = upsellOfferRepository;
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
            final UpsellOffer earlyOffer = applicableOffer(orgId, propertyId, UpsellType.EARLY_CHECKIN);
            final UpsellOffer lateOffer = applicableOffer(orgId, propertyId, UpsellType.LATE_CHECKOUT);
            if (earlyOffer == null && lateOffer == null) {
                return; // aucune offre active du bon type — rien à proposer
            }
            final LocalDate today = LocalDate.now(clock);
            final List<Reservation> upcoming =
                    reservationRepository.findCurrentOrNextByPropertyId(propertyId, today, orgId);

            for (Reservation reservation : upcoming) {
                if (PostStayReviewScanner.resolveGuestEmail(reservation) == null
                        || !welcomeGuideService.hasPublishedGuideFor(reservation)) {
                    continue; // pas de canal d'offre (email + livret requis)
                }
                final ZoneId zone = resolveZone(reservation.getProperty());
                final LocalDate tomorrow = LocalDate.now(clock.withZone(zone)).plusDays(1);
                if (earlyOffer != null && tomorrow.equals(reservation.getCheckIn())
                        && !hasCheckoutOn(upcoming, reservation.getCheckIn())) {
                    emit(orgId, propertyId, reservation, earlyOffer,
                            "Early check-in proposable (réservation #" + reservation.getId() + ")",
                            "arrive demain et le logement est libre la veille — l'arrivée anticipée");
                }
                if (lateOffer != null && tomorrow.equals(reservation.getCheckOut())
                        && !hasCheckinOn(upcoming, reservation.getCheckOut())) {
                    emit(orgId, propertyId, reservation, lateOffer,
                            "Late checkout proposable (réservation #" + reservation.getId() + ")",
                            "part demain et aucune arrivée n'est prévue ce jour-là — le départ tardif");
                }
            }
        } catch (Exception e) {
            log.debug("upsell scan failed org={} property={}: {}", orgId, propertyId, e.getMessage());
        }
    }

    /** Première offre ACTIVE du type, applicable au logement (org-wide ou dédiée). */
    private UpsellOffer applicableOffer(Long orgId, Long propertyId, UpsellType type) {
        return upsellOfferRepository
                .findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(orgId).stream()
                .filter(o -> o.getType() == type)
                .filter(o -> o.getPropertyId() == null || o.getPropertyId().equals(propertyId))
                .findFirst().orElse(null);
    }

    private static boolean hasCheckoutOn(List<Reservation> reservations, LocalDate date) {
        return reservations.stream().anyMatch(r -> date.equals(r.getCheckOut()));
    }

    private static boolean hasCheckinOn(List<Reservation> reservations, LocalDate date) {
        return reservations.stream()
                .anyMatch(r -> date.equals(r.getCheckIn()) && !date.equals(r.getCheckOut()));
    }

    private void emit(Long orgId, Long propertyId, Reservation reservation,
                      UpsellOffer offer, String title, String contextClause) {
        final String guest = reservation.getGuestName() != null && !reservation.getGuestName().isBlank()
                ? reservation.getGuestName().strip() : "Le voyageur";
        suggestionService.recordActionableStrict(
                orgId, propertyId, MODULE_GST, reservation.getId(),
                title,
                guest + " " + contextClause + " « " + offer.getTitle() + " » ("
                        + offer.getPrice() + " " + offer.getCurrency() + ") est proposable. "
                        + "« Envoyer » adresse l'offre par email avec le lien du livret — "
                        + "l'achat et le paiement restent au choix du voyageur.",
                SupervisionActionType.UPSELL_OFFER,
                "{\"reservationId\":" + reservation.getId() + ",\"offerId\":" + offer.getId() + "}",
                offer.getPrice() != null
                        ? offer.getPrice().movePointRight(2)
                                .setScale(0, java.math.RoundingMode.HALF_UP).longValueExact()
                        : null,
                "info");
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
