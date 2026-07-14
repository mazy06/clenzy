package com.clenzy.service.agent.supervision;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Regle de scan DETERMINISTE (module Communication « com ») : pour chaque
 * reservation dont le check-in approche — dans la timezone de la propriete,
 * jamais la zone systeme (regle audit n°9) — et pour laquelle AUCUN email
 * voyageur n'est renseigne, emet une carte HITL INFORMATIONNELLE de l'agent
 * Communication. Le CTA de la carte ouvre, cote front, le modal de fiche client
 * (GuestCardDialog) pour completer l'email : action 100 % front, aucun executeur
 * serveur, jamais d'{@code /apply}.
 *
 * <p>Condition « email manquant » = celle, canonique, de
 * {@link com.clenzy.service.messaging.GuestMessagingService} :
 * {@code guest == null || guest.getEmail() == null || guest.getEmail().isBlank()}.
 * Sans email, les messages et documents automatiques (instructions d'arrivee,
 * livret, relances) ne peuvent pas partir — d'ou l'alerte avant l'envoi des
 * premiers documents de check-in.</p>
 *
 * <p>Zero cout token (heuristique pure, pas d'appel LLM). Deduplication assuree
 * par {@link SupervisionSuggestionService#record} (titre stable). AUTO-RESOLUTION :
 * au debut du scan, toute carte PENDING {@code guest_email_missing} dont la
 * reservation a desormais un email (ou est annulee / check-in passe) est fermee,
 * pour eviter qu'une carte obsolete traine jusqu'au TTL 7 j. Best-effort : toute
 * erreur est absorbee (jamais sur le chemin critique d'un scan).</p>
 */
@Service
public class GuestEmailMissingScanner {

    private static final Logger log = LoggerFactory.getLogger(GuestEmailMissingScanner.class);

    private static final ZoneId DEFAULT_PROPERTY_ZONE = ZoneId.of("Europe/Paris");
    private static final String MODULE_COM = "com";
    private static final String TOOL_NAME = "guest_email_missing";
    /** Horizon d'alerte : on previent des que le check-in tombe dans les 3 jours
     *  (avant l'envoi des premiers documents de check-in). */
    private static final int HORIZON_DAYS = 3;
    private static final String SEVERITY_WARNING = "warning";
    private static final String STATUS_CANCELLED = "cancelled";
    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("d MMM", Locale.FRENCH);

    private final ReservationRepository reservationRepository;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public GuestEmailMissingScanner(ReservationRepository reservationRepository,
                                    SupervisionSuggestionService suggestionService,
                                    Clock clock) {
        this.reservationRepository = reservationRepository;
        this.suggestionService = suggestionService;
        this.clock = clock;
    }

    /**
     * Evalue la regle pour un logement : auto-resout les cartes obsoletes puis
     * emet la carte si un check-in approche sans email voyageur.
     * Best-effort : toute erreur est absorbee (jamais sur le chemin critique d'un scan).
     */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            // Le repository ne renvoie deja QUE des reservations non annulees dont le
            // checkOut >= aujourd'hui (borne large), avec le guest charge (LEFT JOIN FETCH).
            final LocalDate today = LocalDate.now(clock);
            final List<Reservation> upcoming =
                    reservationRepository.findCurrentOrNextByPropertyId(propertyId, today, orgId);

            // Reservations qui justifient ENCORE la carte (check-in dans la fenetre + email manquant).
            final Set<Long> stillMissing = new HashSet<>();
            for (Reservation reservation : upcoming) {
                if (withinWindow(reservation) && emailMissing(reservation)) {
                    stillMissing.add(reservation.getId());
                }
            }

            // Auto-resolution : ferme toute carte PENDING dont la reservation ne remplit
            // plus la condition (email complete, annulee, ou check-in passe → hors fenetre).
            for (SupervisionSuggestion card : suggestionService.findPendingByTool(orgId, propertyId, TOOL_NAME)) {
                if (card.getReservationId() == null || !stillMissing.contains(card.getReservationId())) {
                    suggestionService.dismiss(orgId, card.getId());
                }
            }

            // Emission (dedup PENDING par intitule stable dans le service).
            for (Reservation reservation : upcoming) {
                if (stillMissing.contains(reservation.getId())) {
                    emitMissingEmail(orgId, propertyId, reservation);
                }
            }
        } catch (Exception e) {
            log.debug("guest email scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /** Check-in dans [aujourd'hui, aujourd'hui+HORIZON_DAYS] dans la timezone du logement. */
    private boolean withinWindow(Reservation reservation) {
        if (STATUS_CANCELLED.equalsIgnoreCase(reservation.getStatus())) {
            return false; // defense en profondeur (le repository exclut deja 'cancelled')
        }
        final LocalDate checkIn = reservation.getCheckIn();
        if (checkIn == null) {
            return false;
        }
        final ZoneId zone = resolveZone(reservation.getProperty());
        final LocalDate todayInZone = LocalDate.now(clock.withZone(zone));
        return !checkIn.isBefore(todayInZone)
                && !checkIn.isAfter(todayInZone.plusDays(HORIZON_DAYS));
    }

    /**
     * Condition canonique « email manquant » (miroir de
     * {@link com.clenzy.service.messaging.GuestMessagingService}).
     */
    private boolean emailMissing(Reservation reservation) {
        return reservation.getGuest() == null
                || reservation.getGuest().getEmail() == null
                || reservation.getGuest().getEmail().isBlank();
    }

    private void emitMissingEmail(Long orgId, Long propertyId, Reservation reservation) {
        final String guestName = reservation.getGuestName() != null
                && !reservation.getGuestName().isBlank()
                ? reservation.getGuestName().strip()
                : "Le voyageur";
        // Titre STABLE (sans date ni nom) → dedup fiable sur (org, logement, module, titre) :
        // un scan repete ne re-cree pas la carte tant qu'elle est en attente.
        final String title = "Fiche client incomplète — email voyageur manquant";
        final String motif = String.format(
                "%s arrive le %s (réservation #%d) mais aucun email n'est renseigné : les messages "
                        + "et documents automatiques ne pourront pas être envoyés.",
                guestName, DATE_FMT.format(reservation.getCheckIn()), reservation.getId());
        suggestionService.record(orgId, propertyId, MODULE_COM, TOOL_NAME, title, motif,
                reservation.getId(), SEVERITY_WARNING);
    }

    /** Timezone de la propriete, repli {@code Europe/Paris} si absente ou invalide (regle audit n°9). */
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
            log.debug("Fuseau invalide '{}' pour property={}, repli Europe/Paris", tz, property.getId());
            return DEFAULT_PROPERTY_ZONE;
        }
    }
}
