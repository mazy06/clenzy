package com.clenzy.service.agent.supervision;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Regle de scan DETERMINISTE (module Communication « com ») : pour chaque
 * reservation dont le check-in tombe DEMAIN — dans la timezone de la propriete,
 * jamais la zone systeme (regle audit n°9) — et pour laquelle AUCUN livret
 * d'accueil / instructions d'arrivee n'a ete transmis au voyageur, emet une
 * carte HITL « Voyageur J-1 sans instructions » via {@link SupervisionSuggestionService}.
 *
 * <p>« Instructions transmises » = existence d'un {@link com.clenzy.model.WelcomeGuideToken}
 * lie a la reservation : le token porte l'URL publique du livret partagee au
 * voyageur. Aucun token pour la reservation → le voyageur n'a jamais recu ses
 * instructions d'arrivee. Aucune nouvelle table : le seam existe deja.</p>
 *
 * <p>Zero cout token (heuristique pure, pas d'appel LLM). Deduplication assuree
 * par {@link SupervisionSuggestionService#record} (titre stable, incluant l'ID
 * de reservation pour distinguer plusieurs voyageurs J-1 sur le meme logement).
 * Best-effort : toute erreur est absorbee (jamais sur le chemin critique d'un scan).</p>
 */
@Service
public class GuestInstructionsScanner {

    private static final Logger log = LoggerFactory.getLogger(GuestInstructionsScanner.class);

    private static final ZoneId DEFAULT_PROPERTY_ZONE = ZoneId.of("Europe/Paris");
    private static final String MODULE_COM = "com";
    private static final String TOOL_NAME = "guest_instructions_missing";
    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("d MMM", Locale.FRENCH);

    private final ReservationRepository reservationRepository;
    private final WelcomeGuideTokenRepository tokenRepository;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public GuestInstructionsScanner(ReservationRepository reservationRepository,
                                    WelcomeGuideTokenRepository tokenRepository,
                                    SupervisionSuggestionService suggestionService,
                                    Clock clock) {
        this.reservationRepository = reservationRepository;
        this.tokenRepository = tokenRepository;
        this.suggestionService = suggestionService;
        this.clock = clock;
    }

    /**
     * Evalue la regle pour un logement et emet les cartes HITL correspondantes.
     * Best-effort : toute erreur est absorbee (jamais sur le chemin critique d'un scan).
     */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            // Prochaines reservations non annulees du logement (checkOut >= aujourd'hui,
            // triees checkIn ASC) : on isole ensuite celles dont le check-in tombe DEMAIN
            // dans la timezone de LA propriete (chaque reservation partage le meme logement).
            final LocalDate today = LocalDate.now(clock); // borne large pour le repository
            final List<Reservation> upcoming =
                    reservationRepository.findCurrentOrNextByPropertyId(propertyId, today, orgId);

            for (Reservation reservation : upcoming) {
                final ZoneId zone = resolveZone(reservation.getProperty());
                final LocalDate tomorrow = LocalDate.now(clock.withZone(zone)).plusDays(1);
                if (!tomorrow.equals(reservation.getCheckIn())) {
                    continue; // check-in pas demain (dans la zone du logement)
                }
                if (hasInstructions(reservation.getId())) {
                    continue; // livret / instructions deja transmis
                }
                emitMissingInstructions(orgId, propertyId, reservation, tomorrow);
            }
        } catch (Exception e) {
            log.debug("guest instructions scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * {@code true} si un livret d'accueil a ete transmis au voyageur : au moins un
     * {@link com.clenzy.model.WelcomeGuideToken} existe pour la reservation (le token
     * porte l'URL publique partagee au voyageur). Absence de token → jamais transmis.
     */
    private boolean hasInstructions(Long reservationId) {
        return reservationId != null && !tokenRepository.findByReservationId(reservationId).isEmpty();
    }

    private void emitMissingInstructions(Long orgId, Long propertyId,
                                         Reservation reservation, LocalDate checkIn) {
        final String guestName = reservation.getGuestName() != null
                && !reservation.getGuestName().isBlank()
                ? reservation.getGuestName().strip()
                : "Voyageur";
        // Titre STABLE (sans date ni nom) → dedup fiable sur (org, logement, module,
        // titre) : un scan repete ne re-cree pas la carte tant qu'elle est en attente.
        // Un logement n'heberge qu'un sejour a la fois → un seul voyageur J-1 possible.
        final String title = "Voyageur J-1 sans instructions";
        final String motif = String.format(
                "%s arrive demain (%s) mais aucun livret d'accueil / instructions d'arrivee ne lui a "
                        + "ete transmis. Prepare et envoie ses instructions d'arrivee (reservation #%d).",
                guestName, DATE_FMT.format(checkIn), reservation.getId());
        suggestionService.record(orgId, propertyId, MODULE_COM, TOOL_NAME, title, motif);
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
